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
	mu         sync.RWMutex
	robotID    string
	validator  *TokenValidator
	tokenCache *TokenCache
	state      State
	info       *Info

	onStateChange func(State)
}

// DefaultTokenCacheTTL is the default TTL for cached token claims.
const DefaultTokenCacheTTL = 30 * time.Second

// NewManager creates a new session manager.
func NewManager(robotID string, validator *TokenValidator) *Manager {
	return &Manager{
		robotID:    robotID,
		validator:  validator,
		tokenCache: NewTokenCache(DefaultTokenCacheTTL),
		state:      StatePending,
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

// IsActive returns true if the session is active (not pending or terminated).
func (m *Manager) IsActive() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state == StateActive
}

// Info returns the current session info, or nil if no session.
func (m *Manager) Info() *Info {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.info
}

// ValidateToken validates a capability token using Ed25519 signature.
// Uses caching for <5ms performance on repeated validations.
func (m *Manager) ValidateToken(sessionID, token string) (*Info, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.state == StateTerminated {
		return nil, ErrSessionTerminated
	}

	if m.validator == nil {
		return nil, ErrInvalidToken
	}

	// Check cache first for fast path (use token as cache key)
	cacheKey := token
	if m.tokenCache != nil {
		if cached, ok := m.tokenCache.Get(cacheKey, sessionID); ok {
			return m.claimsToInfo(cached), nil
		}
	}

	// Full cryptographic validation
	claims, err := m.validator.Validate(token, sessionID)
	if err != nil {
		return nil, err
	}

	// Cache for future requests
	if m.tokenCache != nil {
		m.tokenCache.Set(cacheKey, sessionID, claims)
	}

	return m.claimsToInfo(claims), nil
}

// claimsToInfo converts TokenClaims to session Info.
func (m *Manager) claimsToInfo(claims *TokenClaims) *Info {
	return &Info{
		SessionID:   claims.SessionID,
		OperatorDID: claims.Subject,
		RobotID:     m.robotID,
		Scope:       claims.Scope,
		ExpiresAt:   claims.ExpiresAt,
	}
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

	// Invalidate cached tokens for this session
	if m.tokenCache != nil && m.info != nil {
		m.tokenCache.InvalidateSession(m.info.SessionID)
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
