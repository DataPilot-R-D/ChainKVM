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
