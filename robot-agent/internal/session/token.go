// Package session provides JWT token validation for Robot Agent.
package session

import (
	"crypto/ed25519"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrTokenExpired     = errors.New("token expired")
	ErrInvalidSignature = errors.New("invalid signature")
	ErrInvalidAudience  = errors.New("invalid audience")
	ErrSessionMismatch  = errors.New("session ID mismatch")
)

// TokenClaims holds validated JWT claims.
type TokenClaims struct {
	SessionID string
	Subject   string
	Scope     []string
	Nonce     string
	ExpiresAt time.Time
}

// TokenValidator validates Ed25519-signed JWTs.
type TokenValidator struct {
	publicKey ed25519.PublicKey
	robotID   string
	clockSkew time.Duration
}

// NewTokenValidator creates a new token validator.
func NewTokenValidator(publicKey ed25519.PublicKey, robotID string, clockSkew time.Duration) *TokenValidator {
	return &TokenValidator{
		publicKey: publicKey,
		robotID:   robotID,
		clockSkew: clockSkew,
	}
}

// Validate parses and validates a JWT token.
func (v *TokenValidator) Validate(tokenString, expectedSessionID string) (*TokenClaims, error) {
	if tokenString == "" {
		return nil, ErrInvalidToken
	}

	token, err := jwt.Parse(tokenString, v.keyFunc, jwt.WithLeeway(v.clockSkew))
	if err != nil {
		return nil, v.mapError(err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidSignature
	}

	return v.extractClaims(claims, expectedSessionID)
}

// keyFunc returns the public key for signature verification.
func (v *TokenValidator) keyFunc(token *jwt.Token) (any, error) {
	if _, ok := token.Method.(*jwt.SigningMethodEd25519); !ok {
		return nil, ErrInvalidSignature
	}
	return v.publicKey, nil
}

// mapError converts jwt library errors to our error types.
func (v *TokenValidator) mapError(err error) error {
	if errors.Is(err, jwt.ErrTokenExpired) {
		return ErrTokenExpired
	}
	if errors.Is(err, jwt.ErrTokenSignatureInvalid) {
		return ErrInvalidSignature
	}
	return ErrInvalidSignature
}

// extractClaims extracts and validates claims from token.
func (v *TokenValidator) extractClaims(claims jwt.MapClaims, expectedSessionID string) (*TokenClaims, error) {
	aud, ok := claims["aud"].(string)
	if !ok || aud != v.robotID {
		return nil, ErrInvalidAudience
	}

	sid, ok := claims["sid"].(string)
	if !ok || sid != expectedSessionID {
		return nil, ErrSessionMismatch
	}

	sub, _ := claims["sub"].(string)
	nonce, _ := claims["nonce"].(string)

	var expiresAt time.Time
	if exp, ok := claims["exp"].(float64); ok {
		expiresAt = time.Unix(int64(exp), 0)
	}

	return &TokenClaims{
		SessionID: sid,
		Subject:   sub,
		Scope:     v.extractScope(claims),
		Nonce:     nonce,
		ExpiresAt: expiresAt,
	}, nil
}

// extractScope extracts the scope array from claims.
func (v *TokenValidator) extractScope(claims jwt.MapClaims) []string {
	scopeRaw, ok := claims["scope"]
	if !ok {
		return nil
	}

	scopeArr, ok := scopeRaw.([]any)
	if !ok {
		return nil
	}

	scope := make([]string, 0, len(scopeArr))
	for _, s := range scopeArr {
		if str, ok := s.(string); ok {
			scope = append(scope, str)
		}
	}
	return scope
}
