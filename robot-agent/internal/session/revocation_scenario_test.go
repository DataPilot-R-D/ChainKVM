// Package session tests for revocation scenarios.
package session

import (
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRevocation_FullFlow verifies complete state transitions during revocation.
func TestRevocation_FullFlow(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-revoke"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	var stateChanges []State
	var mu sync.Mutex
	mgr.SetStateChangeCallback(func(s State) {
		mu.Lock()
		stateChanges = append(stateChanges, s)
		mu.Unlock()
	})

	token := createTestToken(t, priv, validClaims(robotID, sessionID))

	// 1. Initial state is pending
	assert.Equal(t, StatePending, mgr.State())

	// 2. Validate and activate
	info, err := mgr.ValidateToken(sessionID, token)
	require.NoError(t, err)
	err = mgr.Activate(info)
	require.NoError(t, err)
	assert.Equal(t, StateActive, mgr.State())

	// 3. Terminate (revocation)
	mgr.Terminate()
	assert.Equal(t, StateTerminated, mgr.State())

	// 4. Verify state transitions recorded
	time.Sleep(10 * time.Millisecond) // Allow async callbacks
	mu.Lock()
	changes := make([]State, len(stateChanges))
	copy(changes, stateChanges)
	mu.Unlock()
	assert.Contains(t, changes, StateActive)
	assert.Contains(t, changes, StateTerminated)
}

// TestRevocation_DoubleRevocation verifies idempotent termination.
func TestRevocation_DoubleRevocation(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-double"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	var callbackCount int
	var mu sync.Mutex
	mgr.SetStateChangeCallback(func(s State) {
		if s == StateTerminated {
			mu.Lock()
			callbackCount++
			mu.Unlock()
		}
	})

	token := createTestToken(t, priv, validClaims(robotID, sessionID))
	info, _ := mgr.ValidateToken(sessionID, token)
	_ = mgr.Activate(info)

	// First termination
	mgr.Terminate()
	assert.Equal(t, StateTerminated, mgr.State())

	// Second termination should be idempotent
	mgr.Terminate()
	assert.Equal(t, StateTerminated, mgr.State())

	// Callback should only fire once
	time.Sleep(10 * time.Millisecond)
	mu.Lock()
	count := callbackCount
	mu.Unlock()
	assert.Equal(t, 1, count)
}

// TestRevocation_TokenExpiry verifies validation fails after termination.
func TestRevocation_TokenExpiry(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-expiry"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := createTestToken(t, priv, validClaims(robotID, sessionID))

	// Validate and activate
	info, _ := mgr.ValidateToken(sessionID, token)
	_ = mgr.Activate(info)

	// Terminate
	mgr.Terminate()

	// Token validation should fail after termination
	_, err := mgr.ValidateToken(sessionID, token)
	assert.ErrorIs(t, err, ErrSessionTerminated)
}

// TestRevocation_ConcurrentTermination tests thread-safe termination.
func TestRevocation_ConcurrentTermination(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-concurrent"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	callbackCount := 0
	var mu sync.Mutex
	mgr.SetStateChangeCallback(func(s State) {
		if s == StateTerminated {
			mu.Lock()
			callbackCount++
			mu.Unlock()
		}
	})

	token := createTestToken(t, priv, validClaims(robotID, sessionID))
	info, _ := mgr.ValidateToken(sessionID, token)
	_ = mgr.Activate(info)

	// Concurrent terminations
	var wg sync.WaitGroup
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			mgr.Terminate()
		}()
	}
	wg.Wait()

	assert.Equal(t, StateTerminated, mgr.State())

	// Callback should only fire once
	time.Sleep(10 * time.Millisecond)
	mu.Lock()
	count := callbackCount
	mu.Unlock()
	assert.Equal(t, 1, count)
}

// TestRevocation_ActiveSessionCheck verifies IsActive() behavior.
func TestRevocation_ActiveSessionCheck(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-active"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	assert.False(t, mgr.IsActive(), "pending state should not be active")

	token := createTestToken(t, priv, validClaims(robotID, sessionID))
	info, _ := mgr.ValidateToken(sessionID, token)
	_ = mgr.Activate(info)

	assert.True(t, mgr.IsActive(), "activated state should be active")

	mgr.Terminate()

	assert.False(t, mgr.IsActive(), "terminated state should not be active")
}

// TestRevocation_InfoClearedOnTermination verifies session info is cleared.
func TestRevocation_InfoClearedOnTermination(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-info-clear"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := createTestToken(t, priv, validClaims(robotID, sessionID))
	info, _ := mgr.ValidateToken(sessionID, token)
	_ = mgr.Activate(info)

	assert.NotNil(t, mgr.Info())
	assert.Equal(t, sessionID, mgr.Info().SessionID)

	mgr.Terminate()

	assert.Nil(t, mgr.Info(), "info should be nil after termination")
}

// validClaims creates standard valid JWT claims for testing.
func validClaims(robotID, sessionID string) jwt.MapClaims {
	return jwt.MapClaims{
		"jti":   "token-" + sessionID,
		"sub":   "did:key:test-operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:control", "teleop:view"},
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	}
}
