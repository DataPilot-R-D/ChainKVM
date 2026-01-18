// Package session tests for manager token validation.
package session

import (
	"crypto/ed25519"
	"crypto/rand"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestManager_ValidateToken_Valid(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := createTestToken(t, priv, jwt.MapClaims{
		"jti":   "token-001",
		"sub":   "did:key:operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:control", "teleop:view"},
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	})

	info, err := mgr.ValidateToken(sessionID, token)

	require.NoError(t, err)
	assert.Equal(t, sessionID, info.SessionID)
	assert.Equal(t, "did:key:operator", info.OperatorDID)
	assert.Equal(t, robotID, info.RobotID)
	assert.Contains(t, info.Scope, "teleop:control")
}

func TestManager_ValidateToken_Expired(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := createTestToken(t, priv, jwt.MapClaims{
		"jti":   "token-expired",
		"sub":   "did:key:operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:control"},
		"iat":   time.Now().Add(-2 * time.Hour).Unix(),
		"exp":   time.Now().Add(-1 * time.Hour).Unix(),
	})

	_, err := mgr.ValidateToken(sessionID, token)

	assert.ErrorIs(t, err, ErrTokenExpired)
}

func TestManager_ValidateToken_InvalidSignature(t *testing.T) {
	pub, _ := testKeyPair(t)
	_, wrongPriv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := createTestToken(t, wrongPriv, jwt.MapClaims{
		"jti":   "token-tampered",
		"sub":   "did:key:operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:control"},
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	})

	_, err := mgr.ValidateToken(sessionID, token)

	assert.ErrorIs(t, err, ErrInvalidSignature)
}

func TestManager_ValidateToken_SessionMismatch(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := createTestToken(t, priv, jwt.MapClaims{
		"jti":   "token-wrong-session",
		"sub":   "did:key:operator",
		"aud":   robotID,
		"sid":   "session-123",
		"scope": []any{"teleop:control"},
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	})

	_, err := mgr.ValidateToken("different-session", token)

	assert.ErrorIs(t, err, ErrSessionMismatch)
}

func TestManager_ValidateToken_Caching(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := createTestToken(t, priv, jwt.MapClaims{
		"jti":   "token-cache-test",
		"sub":   "did:key:operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:control"},
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	})

	// First validation (cold)
	info1, err := mgr.ValidateToken(sessionID, token)
	require.NoError(t, err)

	// Second validation (should hit cache)
	info2, err := mgr.ValidateToken(sessionID, token)
	require.NoError(t, err)

	assert.Equal(t, info1.SessionID, info2.SessionID)
	assert.Equal(t, info1.OperatorDID, info2.OperatorDID)
}

func TestManager_HasScope(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := createTestToken(t, priv, jwt.MapClaims{
		"jti":   "token-scope-test",
		"sub":   "did:key:operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:control"},
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	})

	info, err := mgr.ValidateToken(sessionID, token)
	require.NoError(t, err)

	err = mgr.Activate(info)
	require.NoError(t, err)

	assert.True(t, mgr.HasScope("teleop:control"))
	assert.False(t, mgr.HasScope("teleop:estop"))
	assert.False(t, mgr.HasScope("admin"))
}

func TestManager_ValidateToken_Performance(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := createTestToken(t, priv, jwt.MapClaims{
		"jti":   "token-perf-test",
		"sub":   "did:key:operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:control", "teleop:view"},
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	})

	// Warm up cache
	_, err := mgr.ValidateToken(sessionID, token)
	require.NoError(t, err)

	// Measure 1000 cached validations
	iterations := 1000
	start := time.Now()
	for i := 0; i < iterations; i++ {
		_, err := mgr.ValidateToken(sessionID, token)
		require.NoError(t, err)
	}
	elapsed := time.Since(start)

	avgPerValidation := elapsed / time.Duration(iterations)
	t.Logf("Average validation time (cached): %v", avgPerValidation)

	// NFR: Token validation < 5ms
	assert.Less(t, avgPerValidation.Microseconds(), int64(5000),
		"cached validation should be < 5ms")
}

func TestManager_Terminate_ClearsCache(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := createTestToken(t, priv, jwt.MapClaims{
		"jti":   "token-terminate-test",
		"sub":   "did:key:operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:control"},
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	})

	info, err := mgr.ValidateToken(sessionID, token)
	require.NoError(t, err)

	err = mgr.Activate(info)
	require.NoError(t, err)

	mgr.Terminate()

	// After termination, validation should fail
	_, err = mgr.ValidateToken(sessionID, token)
	assert.ErrorIs(t, err, ErrSessionTerminated)
}

// createTestToken generates a signed JWT for testing.
func createTestToken(t *testing.T, priv ed25519.PrivateKey, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(&jwt.SigningMethodEd25519{}, claims)
	signed, err := token.SignedString(priv)
	require.NoError(t, err)
	return signed
}

func BenchmarkManager_ValidateToken_Cold(b *testing.B) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)

	token := jwt.NewWithClaims(&jwt.SigningMethodEd25519{}, jwt.MapClaims{
		"jti":   "token-bench",
		"sub":   "did:key:operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:control"},
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	})
	tokenStr, _ := token.SignedString(priv)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Create fresh manager each iteration (cold cache)
		mgr := NewManager(robotID, validator)
		mgr.ValidateToken(sessionID, tokenStr)
	}
}

func BenchmarkManager_ValidateToken_Cached(b *testing.B) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)
	mgr := NewManager(robotID, validator)

	token := jwt.NewWithClaims(&jwt.SigningMethodEd25519{}, jwt.MapClaims{
		"jti":   "token-bench",
		"sub":   "did:key:operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:control"},
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	})
	tokenStr, _ := token.SignedString(priv)

	// Warm up cache
	mgr.ValidateToken(sessionID, tokenStr)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mgr.ValidateToken(sessionID, tokenStr)
	}
}
