// Package session manages Robot Agent session lifecycle.
package session

import (
	"errors"
	"slices"
	"sync"
	"time"
)

// State represents the session state.
type State string

const (
	StatePending    State = "pending"
	StateActive     State = "active"
	StateTerminated State = "terminated"
)

// Error definitions.
var (
	ErrNoActiveSession    = errors.New("no active session")
	ErrSessionExists      = errors.New("session already exists")
	ErrInvalidToken       = errors.New("invalid token")
	ErrSessionTerminated  = errors.New("session terminated")
)

// Info holds session metadata.
type Info struct {
	SessionID   string
	OperatorDID string
	RobotID     string
	Scope       []string
	ExpiresAt   time.Time
}

// Manager handles session lifecycle.
type Manager struct {
	mu        sync.RWMutex
	robotID   string
	validator *TokenValidator
	state     State
	info      *Info

	onStateChange func(State)
}

// NewManager creates a new session manager.
func NewManager(robotID string, validator *TokenValidator) *Manager {
	return &Manager{
		robotID:   robotID,
		validator: validator,
		state:     StatePending,
	}
}

// SetStateChangeCallback sets a callback for state transitions.
func (m *Manager) SetStateChangeCallback(fn func(State)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onStateChange = fn
}

// State returns the current session state.
func (m *Manager) State() State {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state
}

// Info returns the current session info, or nil if no session.
func (m *Manager) Info() *Info {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.info
}

// ValidateToken validates a capability token using Ed25519 signature.
func (m *Manager) ValidateToken(sessionID, token string) (*Info, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.state == StateTerminated {
		return nil, ErrSessionTerminated
	}

	if m.validator == nil {
		return nil, ErrInvalidToken
	}

	claims, err := m.validator.Validate(token, sessionID)
	if err != nil {
		return nil, err
	}

	info := &Info{
		SessionID:   claims.SessionID,
		OperatorDID: claims.Subject,
		RobotID:     m.robotID,
		Scope:       claims.Scope,
		ExpiresAt:   claims.ExpiresAt,
	}

	return info, nil
}

// Activate transitions to active state with session info.
func (m *Manager) Activate(info *Info) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.state == StateActive {
		return ErrSessionExists
	}
	if m.state == StateTerminated {
		return ErrSessionTerminated
	}

	m.info = info
	m.state = StateActive

	if m.onStateChange != nil {
		go m.onStateChange(StateActive)
	}

	return nil
}

// Terminate ends the current session.
func (m *Manager) Terminate() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.state == StateTerminated {
		return
	}

	m.state = StateTerminated
	m.info = nil

	if m.onStateChange != nil {
		go m.onStateChange(StateTerminated)
	}
}

// Reset resets the session manager for a new connection.
func (m *Manager) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.state = StatePending
	m.info = nil
}

// HasScope checks if the current session has the given scope.
func (m *Manager) HasScope(scope string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.info == nil {
		return false
	}

	return slices.Contains(m.info.Scope, scope)
}
