// Package session provides token caching for performance.
package session

import (
	"sync"
	"time"
)

// TokenCache caches validated token claims to meet <5ms requirement.
type TokenCache struct {
	mu    sync.RWMutex
	cache map[string]*cachedToken
	ttl   time.Duration
}

type cachedToken struct {
	claims   *TokenClaims
	validFor string
	cachedAt time.Time
}

// DefaultCacheTTL is used when an invalid TTL is provided.
const DefaultCacheTTL = 30 * time.Second

// NewTokenCache creates a new token cache with the given TTL.
// If TTL is <= 0, DefaultCacheTTL (30s) is used.
func NewTokenCache(ttl time.Duration) *TokenCache {
	if ttl <= 0 {
		ttl = DefaultCacheTTL
	}
	return &TokenCache{
		cache: make(map[string]*cachedToken),
		ttl:   ttl,
	}
}

// Set stores token claims in the cache.
func (c *TokenCache) Set(jti, sessionID string, claims *TokenClaims) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache[jti] = &cachedToken{
		claims:   claims,
		validFor: sessionID,
		cachedAt: time.Now(),
	}
}

// Get retrieves token claims from cache if valid.
func (c *TokenCache) Get(jti, sessionID string) (*TokenClaims, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.cache[jti]
	if !ok {
		return nil, false
	}

	// Check session match
	if entry.validFor != sessionID {
		return nil, false
	}

	// Check cache TTL
	if time.Since(entry.cachedAt) > c.ttl {
		return nil, false
	}

	// Check token expiry
	if time.Now().After(entry.claims.ExpiresAt) {
		return nil, false
	}

	return entry.claims, true
}

// Invalidate removes a specific token from cache.
func (c *TokenCache) Invalidate(jti string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.cache, jti)
}

// InvalidateSession removes all tokens for a session.
func (c *TokenCache) InvalidateSession(sessionID string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	for jti, entry := range c.cache {
		if entry.validFor == sessionID {
			delete(c.cache, jti)
		}
	}
}
