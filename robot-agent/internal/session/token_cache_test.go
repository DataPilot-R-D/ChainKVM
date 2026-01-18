// Package session tests for token cache.
package session

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenCache_GetSet(t *testing.T) {
	cache := NewTokenCache(30 * time.Second)

	claims := &TokenClaims{
		SessionID: "session-123",
		Subject:   "did:key:operator",
		Scope:     []string{"teleop:control"},
		Nonce:     "nonce-1",
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	cache.Set("jti-1", "session-123", claims)
	result, ok := cache.Get("jti-1", "session-123")

	require.True(t, ok)
	assert.Equal(t, claims.SessionID, result.SessionID)
	assert.Equal(t, claims.Subject, result.Subject)
	assert.Equal(t, claims.Scope, result.Scope)
}

func TestTokenCache_MissOnEmptyJTI(t *testing.T) {
	cache := NewTokenCache(30 * time.Second)

	_, ok := cache.Get("nonexistent", "session-123")

	assert.False(t, ok)
}

func TestTokenCache_MissOnWrongSession(t *testing.T) {
	cache := NewTokenCache(30 * time.Second)

	claims := &TokenClaims{
		SessionID: "session-123",
		Subject:   "did:key:operator",
		Scope:     []string{"teleop:control"},
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	cache.Set("jti-1", "session-123", claims)
	_, ok := cache.Get("jti-1", "wrong-session")

	assert.False(t, ok)
}

func TestTokenCache_TTLExpiry(t *testing.T) {
	cache := NewTokenCache(50 * time.Millisecond)

	claims := &TokenClaims{
		SessionID: "session-123",
		Subject:   "did:key:operator",
		Scope:     []string{"teleop:control"},
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	cache.Set("jti-1", "session-123", claims)

	// Should exist immediately
	_, ok := cache.Get("jti-1", "session-123")
	require.True(t, ok)

	// Wait for TTL expiry
	time.Sleep(60 * time.Millisecond)

	_, ok = cache.Get("jti-1", "session-123")
	assert.False(t, ok)
}

func TestTokenCache_TokenExpiryEviction(t *testing.T) {
	cache := NewTokenCache(1 * time.Hour) // Long cache TTL

	claims := &TokenClaims{
		SessionID: "session-123",
		Subject:   "did:key:operator",
		Scope:     []string{"teleop:control"},
		ExpiresAt: time.Now().Add(50 * time.Millisecond), // Short token expiry
	}

	cache.Set("jti-1", "session-123", claims)

	// Wait for token expiry
	time.Sleep(60 * time.Millisecond)

	_, ok := cache.Get("jti-1", "session-123")
	assert.False(t, ok)
}

func TestTokenCache_Invalidate(t *testing.T) {
	cache := NewTokenCache(30 * time.Second)

	claims := &TokenClaims{
		SessionID: "session-123",
		Subject:   "did:key:operator",
		Scope:     []string{"teleop:control"},
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	cache.Set("jti-1", "session-123", claims)
	cache.Invalidate("jti-1")

	_, ok := cache.Get("jti-1", "session-123")
	assert.False(t, ok)
}

func TestTokenCache_InvalidateSession(t *testing.T) {
	cache := NewTokenCache(30 * time.Second)

	claims1 := &TokenClaims{
		SessionID: "session-123",
		Subject:   "did:key:operator",
		Scope:     []string{"teleop:control"},
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	claims2 := &TokenClaims{
		SessionID: "session-456",
		Subject:   "did:key:operator2",
		Scope:     []string{"teleop:control"},
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	cache.Set("jti-1", "session-123", claims1)
	cache.Set("jti-2", "session-456", claims2)

	cache.InvalidateSession("session-123")

	_, ok1 := cache.Get("jti-1", "session-123")
	_, ok2 := cache.Get("jti-2", "session-456")

	assert.False(t, ok1, "session-123 should be invalidated")
	assert.True(t, ok2, "session-456 should still exist")
}

func TestTokenCache_ConcurrentAccess(t *testing.T) {
	cache := NewTokenCache(30 * time.Second)
	done := make(chan bool)

	for i := 0; i < 100; i++ {
		go func(id int) {
			claims := &TokenClaims{
				SessionID: "session-123",
				Subject:   "did:key:operator",
				Scope:     []string{"teleop:control"},
				ExpiresAt: time.Now().Add(1 * time.Hour),
			}
			cache.Set("jti-concurrent", "session-123", claims)
			cache.Get("jti-concurrent", "session-123")
			done <- true
		}(i)
	}

	for i := 0; i < 100; i++ {
		<-done
	}

	// No race conditions or panics means pass
}

func BenchmarkTokenCache_Get(b *testing.B) {
	cache := NewTokenCache(30 * time.Second)

	claims := &TokenClaims{
		SessionID: "session-123",
		Subject:   "did:key:operator",
		Scope:     []string{"teleop:control", "teleop:view"},
		Nonce:     "nonce-1",
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	cache.Set("jti-bench", "session-123", claims)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cache.Get("jti-bench", "session-123")
	}
}

func BenchmarkTokenCache_Set(b *testing.B) {
	cache := NewTokenCache(30 * time.Second)

	claims := &TokenClaims{
		SessionID: "session-123",
		Subject:   "did:key:operator",
		Scope:     []string{"teleop:control", "teleop:view"},
		Nonce:     "nonce-1",
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cache.Set("jti-bench", "session-123", claims)
	}
}
