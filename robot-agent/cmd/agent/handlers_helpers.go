package main

import (
	"encoding/json"
	"time"

	"go.uber.org/zap"

	"github.com/datapilot/chainkvm/robot-agent/internal/audit"
	"github.com/datapilot/chainkvm/robot-agent/internal/metrics"
	"github.com/datapilot/chainkvm/robot-agent/internal/safety"
	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

func (a *agent) publishAuditEvent(trigger safety.Trigger) {
	if trigger != safety.TriggerInvalidCmds || a.audit == nil {
		return
	}
	a.audit.Publish(audit.Event{
		EventType: audit.EventInvalidCommandThreshold,
		SessionID: a.currentSessionID(),
		Timestamp: time.Now().UTC(),
		Metadata:  map[string]string{"trigger": string(trigger)},
	})
}

func (a *agent) sendStateNotification(haltErr error) {
	if a.transport == nil {
		a.logger.Warn("cannot send state notification: transport is nil")
		return
	}

	robotState := protocol.RobotStateSafeStop
	sessionState := "safe_stop"
	if haltErr != nil {
		robotState = protocol.RobotStateSafeStopFailed
		sessionState = "safe_stop_failed"
	}

	stateMsg := protocol.StateMessage{
		Type:         protocol.TypeState,
		RobotState:   robotState,
		SessionState: sessionState,
		T:            time.Now().UnixMilli(),
	}
	data, err := json.Marshal(stateMsg)
	if err != nil {
		a.logger.Error("failed to marshal state message", zap.Error(err))
		return
	}
	if err := a.transport.SendData(data); err != nil {
		a.logger.Warn("failed to send safe-stop state", zap.Error(err))
	}
}

func (a *agent) currentSessionID() string {
	if a.sessionMgr == nil {
		return ""
	}
	if info := a.sessionMgr.Info(); info != nil {
		return info.SessionID
	}
	return ""
}

// RevocationMetrics returns the revocation metrics collector for reporting.
func (a *agent) RevocationMetrics() *metrics.RevocationCollector {
	return a.revocationMetrics
}

func (a *agent) recordRevocationTimestamp(fn func(*metrics.RevocationTimestamps)) {
	if a.currentRevocation != nil {
		fn(a.currentRevocation)
	}
}

func (a *agent) completeRevocationMeasurement() {
	if a.currentRevocation == nil || a.revocationMetrics == nil {
		return
	}
	a.currentRevocation.SafeStopCompleted = time.Now()
	a.revocationMetrics.Record(*a.currentRevocation)
	a.currentRevocation = nil
}

// SessionSetupMetrics returns the session setup metrics collector.
func (a *agent) SessionSetupMetrics() *metrics.SessionSetupCollector {
	return a.sessionSetupMetrics
}

func (a *agent) recordSessionSetupTimestamp(fn func(*metrics.SessionSetupTimestamps)) {
	if a.currentSessionSetup != nil {
		fn(a.currentSessionSetup)
	}
}

func (a *agent) completeSessionSetupMeasurement() {
	if a.currentSessionSetup == nil || a.sessionSetupMetrics == nil {
		return
	}
	a.sessionSetupMetrics.Record(*a.currentSessionSetup)
	a.currentSessionSetup = nil
}

// ControlRTTMetrics returns the control RTT metrics collector.
func (a *agent) ControlRTTMetrics() *metrics.ControlRTTCollector {
	return a.controlRTTMetrics
}

func (a *agent) startControlRTTMeasurement() {
	if a.controlRTTMetrics == nil {
		return
	}

	a.pingTicker = time.NewTicker(a.pingInterval)
	go func() {
		consecutiveMarshalErrors := 0
		consecutiveSendErrors := 0
		const maxConsecutiveErrors = 3

		for range a.pingTicker.C {
			if a.transport == nil || a.sessionMgr.State() != "active" {
				continue
			}

			ping := a.controlRTTMetrics.GeneratePing()
			data, err := json.Marshal(ping)
			if err != nil {
				consecutiveMarshalErrors++
				a.logger.Error("failed to marshal ping",
					zap.Error(err),
					zap.Int("consecutive_errors", consecutiveMarshalErrors))
				if consecutiveMarshalErrors >= maxConsecutiveErrors {
					a.logger.Error("RTT measurement circuit breaker triggered: marshal failures",
						zap.Int("consecutive_errors", consecutiveMarshalErrors))
					a.stopControlRTTMeasurement()
					return
				}
				continue
			}
			consecutiveMarshalErrors = 0

			if err := a.transport.SendData(data); err != nil {
				consecutiveSendErrors++
				a.logger.Warn("failed to send ping",
					zap.Error(err),
					zap.Int("consecutive_errors", consecutiveSendErrors))
				if consecutiveSendErrors >= maxConsecutiveErrors {
					a.logger.Error("RTT measurement circuit breaker triggered: send failures",
						zap.Int("consecutive_errors", consecutiveSendErrors))
					a.stopControlRTTMeasurement()
					return
				}
			} else {
				consecutiveSendErrors = 0
			}
		}
	}()

	a.logger.Debug("control RTT measurement started", zap.Duration("interval", a.pingInterval))
}

func (a *agent) stopControlRTTMeasurement() {
	if a.pingTicker != nil {
		a.pingTicker.Stop()
		a.pingTicker = nil
		a.logger.Debug("control RTT measurement stopped")
	}
}
