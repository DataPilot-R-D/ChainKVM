// Package safety implements the Robot Agent safety subsystem.
package safety

import (
	"sync"
	"time"
)

// Trigger represents a safety trigger type.
type Trigger string

const (
	TriggerEStop         Trigger = "e_stop"
	TriggerControlLoss   Trigger = "control_loss"
	TriggerInvalidCmds   Trigger = "invalid_commands"
	TriggerTokenExpired  Trigger = "token_expired"
	TriggerRevoked       Trigger = "revoked"
)

// Monitor watches for safety conditions and triggers safe-stop.
type Monitor struct {
	mu sync.Mutex

	controlLossTimeout time.Duration
	invalidCmdThreshold int

	lastControlTime time.Time
	invalidCmdCount int

	safeStopFn func(trigger Trigger)
	stopped    bool
}

// NewMonitor creates a new safety monitor.
func NewMonitor(
	controlLossTimeout time.Duration,
	invalidCmdThreshold int,
	safeStopFn func(trigger Trigger),
) *Monitor {
	return &Monitor{
		controlLossTimeout:  controlLossTimeout,
		invalidCmdThreshold: invalidCmdThreshold,
		safeStopFn:          safeStopFn,
		lastControlTime:     time.Now(),
	}
}

// OnValidControl should be called when a valid control message is received.
func (m *Monitor) OnValidControl() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.lastControlTime = time.Now()
	m.invalidCmdCount = 0
}

// OnInvalidCommand should be called when an invalid command is received.
func (m *Monitor) OnInvalidCommand() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.invalidCmdCount++
	if m.invalidCmdCount >= m.invalidCmdThreshold {
		m.triggerSafeStop(TriggerInvalidCmds)
	}
}

// OnEStop should be called when e-stop command is received.
func (m *Monitor) OnEStop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.triggerSafeStop(TriggerEStop)
}

// OnTokenExpired should be called when the session token expires.
func (m *Monitor) OnTokenExpired() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.triggerSafeStop(TriggerTokenExpired)
}

// OnRevoked should be called when session is revoked by gateway.
func (m *Monitor) OnRevoked() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.triggerSafeStop(TriggerRevoked)
}

// CheckControlLoss checks if control loss timeout has been exceeded.
// Should be called periodically (e.g., every 100ms).
func (m *Monitor) CheckControlLoss() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.stopped {
		return
	}

	elapsed := time.Since(m.lastControlTime)
	if elapsed > m.controlLossTimeout {
		m.triggerSafeStop(TriggerControlLoss)
	}
}

// Reset resets the monitor state (e.g., after session end).
func (m *Monitor) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.invalidCmdCount = 0
	m.lastControlTime = time.Now()
	m.stopped = false
}

// triggerSafeStop triggers safe-stop (must be called with lock held).
func (m *Monitor) triggerSafeStop(trigger Trigger) {
	if m.stopped {
		return
	}
	m.stopped = true

	if m.safeStopFn != nil {
		go m.safeStopFn(trigger)
	}
}
