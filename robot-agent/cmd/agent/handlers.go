// Package main contains signaling handler implementations for the Robot Agent.
package main

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/pion/webrtc/v3"
	"go.uber.org/zap"

	"github.com/datapilot/chainkvm/robot-agent/internal/audit"
	"github.com/datapilot/chainkvm/robot-agent/internal/metrics"
	"github.com/datapilot/chainkvm/robot-agent/internal/safety"
)

// errHardwareUnavailable indicates the hardware stop could not be executed.
var errHardwareUnavailable = errors.New("hardware stop unavailable: handler not initialized")

// OnOffer handles incoming SDP offer from console.
func (a *agent) OnOffer(sessionID, token string, sdpData []byte) {
	// Start session setup timing
	a.currentSessionSetup = &metrics.SessionSetupTimestamps{
		SessionID:     sessionID,
		OfferReceived: time.Now(),
	}

	a.logger.Info("received offer", zap.String("session_id", sessionID))

	// Validate capability token before establishing connection
	info, err := a.sessionMgr.ValidateToken(sessionID, token)
	if err != nil {
		a.logger.Error("token validation failed",
			zap.String("session_id", sessionID),
			zap.Error(err))
		return
	}
	a.recordSessionSetupTimestamp(func(ts *metrics.SessionSetupTimestamps) { ts.TokenValidated = time.Now() })

	if err := a.transport.CreatePeerConnection(); err != nil {
		a.logger.Error("failed to create peer connection", zap.Error(err))
		return
	}
	a.recordSessionSetupTimestamp(func(ts *metrics.SessionSetupTimestamps) { ts.PeerConnectionCreated = time.Now() })

	a.transport.SetICECallback(func(candidate []byte) {
		if err := a.signaling.SendICE(sessionID, candidate); err != nil {
			a.logger.Warn("failed to send ICE candidate", zap.Error(err))
		}
	})

	a.transport.SetDataHandler(a.onDataMessage)

	a.transport.SetStateCallback(func(state webrtc.PeerConnectionState) {
		switch state {
		case webrtc.PeerConnectionStateConnected:
			a.recordSessionSetupTimestamp(func(ts *metrics.SessionSetupTimestamps) {
				ts.ConnectionEstablished = time.Now()
			})
			if err := a.sessionMgr.Activate(info); err != nil {
				a.logger.Error("session activation failed",
					zap.String("session_id", info.SessionID),
					zap.Error(err))
				return
			}
			a.recordSessionSetupTimestamp(func(ts *metrics.SessionSetupTimestamps) {
				ts.SessionActivated = time.Now()
				ts.DataChannelReady = time.Now()
			})
			a.completeSessionSetupMeasurement()
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
		return
	}
	a.recordSessionSetupTimestamp(func(ts *metrics.SessionSetupTimestamps) { ts.AnswerSent = time.Now() })
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
	// Start timestamp capture for revocation measurement
	ts := &metrics.RevocationTimestamps{
		SessionID:       sessionID,
		MessageReceived: time.Now(),
	}
	a.currentRevocation = ts

	a.logger.Warn("session revoked",
		zap.String("session_id", sessionID),
		zap.String("reason", reason))

	ts.HandlerStarted = time.Now()

	// Close WebRTC transport to stop media and control
	if a.transport != nil {
		a.transport.Close()
	}
	ts.TransportClosed = time.Now()

	// Terminate session (invalidates token cache)
	a.sessionMgr.Terminate()
	ts.SessionTerminated = time.Now()

	// Trigger safe-stop (captures SafeStopTriggered/Completed in onSafeStop)
	ts.SafeStopTriggered = time.Now()
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

	a.logger.Warn("safe-stop triggered",
		zap.String("trigger", string(trigger)),
		zap.Int("priority", int(trigger.Priority())),
		zap.Bool("recoverable", trigger.IsRecoverable()))

	haltErr := a.executeHardwareStop(trigger)
	a.recordRevocationTimestamp(func(ts *metrics.RevocationTimestamps) { ts.HardwareStopIssued = time.Now() })

	a.publishAuditEvent(trigger)
	a.sendStateNotification(haltErr)
	a.completeRevocationMeasurement()

	duration := time.Since(start)
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

func (a *agent) executeHardwareStop(trigger safety.Trigger) error {
	if a.handler == nil || a.handler.RobotAPI() == nil {
		a.logger.Error("CRITICAL: cannot execute hardware stop - handler not initialized",
			zap.String("trigger", string(trigger)),
			zap.Bool("handler_nil", a.handler == nil))
		return errHardwareUnavailable
	}

	if err := a.handler.RobotAPI().EStop(); err != nil {
		a.logger.Error("CRITICAL: hardware stop failed - robot may still be moving",
			zap.Error(err),
			zap.String("trigger", string(trigger)))
		return err
	}
	return nil
}

