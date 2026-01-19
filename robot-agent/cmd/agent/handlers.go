// Package main contains signaling handler implementations for the Robot Agent.
package main

import (
	"encoding/json"
	"time"

	"github.com/pion/webrtc/v3"
	"go.uber.org/zap"

	"github.com/datapilot/chainkvm/robot-agent/internal/audit"
	"github.com/datapilot/chainkvm/robot-agent/internal/safety"
	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// OnOffer handles incoming SDP offer from console.
func (a *agent) OnOffer(sessionID, token string, sdpData []byte) {
	a.logger.Info("received offer", zap.String("session_id", sessionID))

	// Validate capability token before establishing connection
	info, err := a.sessionMgr.ValidateToken(sessionID, token)
	if err != nil {
		a.logger.Error("token validation failed",
			zap.String("session_id", sessionID),
			zap.Error(err))
		return
	}

	if err := a.transport.CreatePeerConnection(); err != nil {
		a.logger.Error("failed to create peer connection", zap.Error(err))
		return
	}

	a.transport.SetICECallback(func(candidate []byte) {
		if err := a.signaling.SendICE(sessionID, candidate); err != nil {
			a.logger.Warn("failed to send ICE candidate", zap.Error(err))
		}
	})

	a.transport.SetDataHandler(a.onDataMessage)

	a.transport.SetStateCallback(func(state webrtc.PeerConnectionState) {
		switch state {
		case webrtc.PeerConnectionStateConnected:
			if err := a.sessionMgr.Activate(info); err != nil {
				a.logger.Error("session activation failed",
					zap.String("session_id", info.SessionID),
					zap.Error(err))
				return
			}
			a.safety.Reset()
		case webrtc.PeerConnectionStateFailed, webrtc.PeerConnectionStateClosed:
			a.sessionMgr.Terminate()
		}
	})

	answer, err := a.transport.HandleOffer(sdpData)
	if err != nil {
		a.logger.Error("failed to handle offer", zap.Error(err))
		return
	}

	if err := a.signaling.SendAnswer(sessionID, answer); err != nil {
		a.logger.Error("failed to send answer", zap.Error(err))
	}
}

// OnAnswer handles SDP answer (robot is always answerer).
func (a *agent) OnAnswer(sessionID string, sdp []byte) {
	a.logger.Warn("unexpected answer received", zap.String("session_id", sessionID))
}

// OnICE handles incoming ICE candidate.
func (a *agent) OnICE(sessionID string, candidate []byte) {
	if err := a.transport.AddICECandidate(candidate); err != nil {
		a.logger.Warn("failed to add ICE candidate", zap.Error(err))
	}
}

// OnBye handles session termination from gateway.
func (a *agent) OnBye(sessionID string) {
	a.logger.Info("received bye", zap.String("session_id", sessionID))
	a.safety.OnRevoked()
}

// OnRevoked handles session revocation from gateway.
func (a *agent) OnRevoked(sessionID, reason string) {
	a.logger.Warn("session revoked",
		zap.String("session_id", sessionID),
		zap.String("reason", reason))

	// Close WebRTC transport to stop media and control
	if a.transport != nil {
		a.transport.Close()
	}

	// Terminate session (invalidates token cache)
	a.sessionMgr.Terminate()

	// Trigger safe-stop
	a.safety.OnRevoked()

	// Emit termination audit event
	if a.audit != nil {
		a.audit.Publish(audit.Event{
			EventType: audit.EventSessionRevoked,
			SessionID: sessionID,
			Timestamp: time.Now().UTC(),
			Metadata:  map[string]string{"reason": reason},
		})
	}
}

func (a *agent) onDataMessage(data []byte) {
	ack, err := a.handler.HandleMessage(data)
	if err != nil {
		a.logger.Debug("message handling error", zap.Error(err))
		return
	}

	if ack != nil {
		ackData, err := json.Marshal(ack)
		if err != nil {
			a.logger.Error("failed to marshal ack", zap.Error(err))
			return
		}
		if err := a.transport.SendData(ackData); err != nil {
			a.logger.Warn("failed to send ack", zap.Error(err))
		}
	}
}

func (a *agent) onSafeStop(trigger safety.Trigger) safety.TransitionResult {
	start := time.Now()

	// Log with priority information
	a.logger.Warn("safe-stop triggered",
		zap.String("trigger", string(trigger)),
		zap.Int("priority", int(trigger.Priority())),
		zap.Bool("recoverable", trigger.IsRecoverable()))

	// 1. Execute hardware stop (critical path for <100ms)
	var haltErr error
	if a.handler != nil && a.handler.RobotAPI() != nil {
		haltErr = a.handler.RobotAPI().EStop()
		if haltErr != nil {
			a.logger.Error("hardware stop failed", zap.Error(haltErr))
		}
	}

	duration := time.Since(start)

	// 2. Emit audit event for invalid command threshold
	if trigger == safety.TriggerInvalidCmds && a.audit != nil {
		a.audit.Publish(audit.Event{
			EventType: audit.EventInvalidCommandThreshold,
			SessionID: a.currentSessionID(),
			Timestamp: time.Now().UTC(),
			Metadata:  map[string]string{"trigger": string(trigger)},
		})
	}

	// 3. Send state notification to console
	stateMsg := protocol.StateMessage{
		Type:         protocol.TypeState,
		RobotState:   protocol.RobotStateSafeStop,
		SessionState: "safe_stop",
		T:            time.Now().UnixMilli(),
	}
	data, err := json.Marshal(stateMsg)
	if err != nil {
		a.logger.Error("failed to marshal state message", zap.Error(err))
	} else if err := a.transport.SendData(data); err != nil {
		a.logger.Warn("failed to send safe-stop state", zap.Error(err))
	}

	// 4. Log timing for measurement (FR-14: <100ms)
	a.logger.Info("safe-stop transition complete",
		zap.Duration("duration", duration),
		zap.Bool("under_100ms", duration < 100*time.Millisecond))

	return safety.TransitionResult{
		Trigger:   trigger,
		Timestamp: time.Now(),
		Duration:  duration,
		Error:     haltErr,
	}
}

func (a *agent) currentSessionID() string {
	if a.sessionMgr == nil {
		return ""
	}
	info := a.sessionMgr.Info()
	if info == nil {
		return ""
	}
	return info.SessionID
}
