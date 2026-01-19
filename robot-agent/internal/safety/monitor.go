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

// SafeStopCallback is the signature for safe-stop callbacks.
// Returns TransitionResult for confirmation and timing measurement.
type SafeStopCallback func(trigger Trigger) TransitionResult

// Monitor watches for safety conditions and triggers safe-stop.
type Monitor struct {
	mu sync.Mutex

	controlLossTimeout   time.Duration
	invalidCmdThreshold  int
	invalidCmdTimeWindow time.Duration

	lastControlTime     time.Time
	invalidCmdCount     int
	firstInvalidCmdTime time.Time

	safeStopFn    SafeStopCallback
	stopped       bool
	inControlLoss bool // tracks recoverable control loss state

	// lastTransition stores the result of the most recent transition.
	lastTransition TransitionResult
}

// NewMonitor creates a new safety monitor.
func NewMonitor(
	controlLossTimeout time.Duration,
	invalidCmdThreshold int,
	invalidCmdTimeWindow time.Duration,
	safeStopFn SafeStopCallback,
) *Monitor {
	return &Monitor{
		controlLossTimeout:   controlLossTimeout,
		invalidCmdThreshold:  invalidCmdThreshold,
		invalidCmdTimeWindow: invalidCmdTimeWindow,
		safeStopFn:           safeStopFn,
		lastControlTime:      time.Now(),
	}
}

// LastTransition returns the result of the most recent safe-stop transition.
func (m *Monitor) LastTransition() TransitionResult {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.lastTransition
}

// OnValidControl should be called when a valid control message is received.
// If in control loss state, this allows recovery.
func (m *Monitor) OnValidControl() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.lastControlTime = time.Now()
	m.invalidCmdCount = 0
	m.firstInvalidCmdTime = time.Time{}

	// Recover from control loss on reconnection
	if m.inControlLoss {
		m.inControlLoss = false
		m.stopped = false
	}
}

// OnInvalidCommand should be called when an invalid command is received.
func (m *Monitor) OnInvalidCommand() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()

	// Reset counter if time window expired (when window is enabled)
	windowExpired := m.invalidCmdTimeWindow > 0 &&
		m.invalidCmdCount > 0 &&
		now.Sub(m.firstInvalidCmdTime) > m.invalidCmdTimeWindow
	if windowExpired {
		m.invalidCmdCount = 0
	}

	// Start new window on first invalid command
	if m.invalidCmdCount == 0 {
		m.firstInvalidCmdTime = now
	}

	m.invalidCmdCount++
	if m.invalidCmdCount >= m.invalidCmdThreshold {
		m.triggerSafeStop(TriggerInvalidCmds)
	}
}

// OnEStop should be called when e-stop command is received.
func (m *Monitor) OnEStop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.inControlLoss = false // E-Stop is non-recoverable, clear any control loss state
	m.triggerSafeStop(TriggerEStop)
}

// OnTokenExpired should be called when the session token expires.
func (m *Monitor) OnTokenExpired() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.inControlLoss = false // Non-recoverable
	m.triggerSafeStop(TriggerTokenExpired)
}

// OnRevoked should be called when session is revoked by gateway.
func (m *Monitor) OnRevoked() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.inControlLoss = false // Non-recoverable
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
		m.inControlLoss = true
		m.triggerSafeStop(TriggerControlLoss)
	}
}

// Reset resets the monitor state (e.g., after session end).
func (m *Monitor) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.invalidCmdCount = 0
	m.firstInvalidCmdTime = time.Time{}
	m.lastControlTime = time.Now()
	m.stopped = false
	m.inControlLoss = false
}

// triggerSafeStop triggers safe-stop synchronously (must be called with lock held).
// The callback is called directly to ensure <100ms transition time under load.
func (m *Monitor) triggerSafeStop(trigger Trigger) {
	if m.stopped {
		return
	}
	m.stopped = true

	if m.safeStopFn != nil {
		// Call synchronously - no goroutine to guarantee timing
		m.lastTransition = m.safeStopFn(trigger)
	}
}
