// Package session tests for token validation.
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

// testKeyPair generates a test Ed25519 key pair.
func testKeyPair(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)
	return pub, priv
}

// signTestToken creates a signed JWT for testing.
func signTestToken(t *testing.T, priv ed25519.PrivateKey, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(&jwt.SigningMethodEd25519{}, claims)
	token.Header["kid"] = "test-key-id"
	signed, err := token.SignedString(priv)
	require.NoError(t, err)
	return signed
}

func TestTokenValidator_ValidToken(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)

	claims := jwt.MapClaims{
		"sub":   "did:key:test-operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:view", "teleop:control"},
		"nonce": "test-nonce",
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	}
	token := signTestToken(t, priv, claims)

	result, err := validator.Validate(token, sessionID)

	require.NoError(t, err)
	assert.Equal(t, sessionID, result.SessionID)
	assert.Equal(t, "did:key:test-operator", result.Subject)
	assert.Equal(t, []string{"teleop:view", "teleop:control"}, result.Scope)
	assert.Equal(t, "test-nonce", result.Nonce)
}

func TestTokenValidator_ExpiredToken(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)

	claims := jwt.MapClaims{
		"sub":   "did:key:test-operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:view"},
		"nonce": "test-nonce",
		"iat":   time.Now().Add(-2 * time.Hour).Unix(),
		"exp":   time.Now().Add(-1 * time.Hour).Unix(),
	}
	token := signTestToken(t, priv, claims)

	_, err := validator.Validate(token, sessionID)

	assert.ErrorIs(t, err, ErrTokenExpired)
}

func TestTokenValidator_InvalidSignature(t *testing.T) {
	pub, _ := testKeyPair(t)
	_, wrongPriv := testKeyPair(t) // Different key pair
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)

	claims := jwt.MapClaims{
		"sub":   "did:key:test-operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:view"},
		"nonce": "test-nonce",
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	}
	token := signTestToken(t, wrongPriv, claims)

	_, err := validator.Validate(token, sessionID)

	assert.ErrorIs(t, err, ErrInvalidSignature)
}

func TestTokenValidator_WrongAudience(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)

	claims := jwt.MapClaims{
		"sub":   "did:key:test-operator",
		"aud":   "wrong-robot-id",
		"sid":   sessionID,
		"scope": []any{"teleop:view"},
		"nonce": "test-nonce",
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	}
	token := signTestToken(t, priv, claims)

	_, err := validator.Validate(token, sessionID)

	assert.ErrorIs(t, err, ErrInvalidAudience)
}

func TestTokenValidator_WrongSessionID(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)

	claims := jwt.MapClaims{
		"sub":   "did:key:test-operator",
		"aud":   robotID,
		"sid":   "different-session",
		"scope": []any{"teleop:view"},
		"nonce": "test-nonce",
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	}
	token := signTestToken(t, priv, claims)

	_, err := validator.Validate(token, "session-123")

	assert.ErrorIs(t, err, ErrSessionMismatch)
}

func TestTokenValidator_ClockSkewTolerance(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"
	clockSkew := 30 * time.Second

	validator := NewTokenValidator(pub, robotID, clockSkew)

	// Token expires 20 seconds ago (within 30s tolerance)
	claims := jwt.MapClaims{
		"sub":   "did:key:test-operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:view"},
		"nonce": "test-nonce",
		"iat":   time.Now().Add(-1 * time.Hour).Unix(),
		"exp":   time.Now().Add(-20 * time.Second).Unix(),
	}
	token := signTestToken(t, priv, claims)

	result, err := validator.Validate(token, sessionID)

	require.NoError(t, err)
	assert.Equal(t, sessionID, result.SessionID)
}

func TestTokenValidator_ScopeExtraction(t *testing.T) {
	pub, priv := testKeyPair(t)
	robotID := "robot-001"
	sessionID := "session-123"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)

	claims := jwt.MapClaims{
		"sub":   "did:key:test-operator",
		"aud":   robotID,
		"sid":   sessionID,
		"scope": []any{"teleop:view", "teleop:control", "teleop:estop"},
		"nonce": "test-nonce",
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	}
	token := signTestToken(t, priv, claims)

	result, err := validator.Validate(token, sessionID)

	require.NoError(t, err)
	assert.Equal(t, []string{"teleop:view", "teleop:control", "teleop:estop"}, result.Scope)
}

func TestTokenValidator_MalformedToken(t *testing.T) {
	pub, _ := testKeyPair(t)
	robotID := "robot-001"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)

	_, err := validator.Validate("not.a.valid.token", "session-123")

	assert.Error(t, err)
}

func TestTokenValidator_EmptyToken(t *testing.T) {
	pub, _ := testKeyPair(t)
	robotID := "robot-001"

	validator := NewTokenValidator(pub, robotID, 30*time.Second)

	_, err := validator.Validate("", "session-123")

	assert.Error(t, err)
}
