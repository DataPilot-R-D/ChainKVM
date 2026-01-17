// Package session provides JWKS fetching for Robot Agent token validation.
package session

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"
)

var (
	ErrKeyNotFound = errors.New("key not found in JWKS")
	ErrFetchFailed = errors.New("failed to fetch JWKS")
	ErrInvalidJWKS = errors.New("invalid JWKS format")
)

// JWKSFetcher fetches and caches JWKS from Gateway.
type JWKSFetcher struct {
	url        string
	httpClient *http.Client
	cacheTTL   time.Duration

	mu        sync.RWMutex
	cache     map[string]ed25519.PublicKey
	lastFetch time.Time
}

// jwksResponse represents the JWKS JSON structure.
type jwksResponse struct {
	Keys []jwkKey `json:"keys"`
}

// jwkKey represents a single JWK.
type jwkKey struct {
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	Kid string `json:"kid"`
	X   string `json:"x"`
	Use string `json:"use"`
}

// NewJWKSFetcher creates a new JWKS fetcher.
func NewJWKSFetcher(url string, cacheTTL time.Duration) *JWKSFetcher {
	return &JWKSFetcher{
		url:        url,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		cacheTTL:   cacheTTL,
		cache:      make(map[string]ed25519.PublicKey),
	}
}

// GetPublicKey returns the public key for the given key ID.
func (f *JWKSFetcher) GetPublicKey(kid string) (ed25519.PublicKey, error) {
	f.mu.RLock()
	if key, ok := f.cache[kid]; ok {
		f.mu.RUnlock()
		return key, nil
	}
	f.mu.RUnlock()

	// Cache miss - refresh JWKS
	if err := f.Refresh(); err != nil {
		return nil, err
	}

	f.mu.RLock()
	defer f.mu.RUnlock()

	key, ok := f.cache[kid]
	if !ok {
		return nil, ErrKeyNotFound
	}
	return key, nil
}

// Refresh fetches the latest JWKS from the server.
func (f *JWKSFetcher) Refresh() error {
	resp, err := f.httpClient.Get(f.url)
	if err != nil {
		return errors.Join(ErrFetchFailed, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ErrFetchFailed
	}

	var jwks jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return errors.Join(ErrInvalidJWKS, err)
	}

	f.updateCache(jwks)
	return nil
}

// updateCache parses JWKs and updates the cache.
func (f *JWKSFetcher) updateCache(jwks jwksResponse) {
	newCache := make(map[string]ed25519.PublicKey)

	for _, key := range jwks.Keys {
		if key.Kty != "OKP" || key.Crv != "Ed25519" {
			continue
		}

		pubBytes, err := base64.RawURLEncoding.DecodeString(key.X)
		if err != nil || len(pubBytes) != ed25519.PublicKeySize {
			continue
		}

		newCache[key.Kid] = ed25519.PublicKey(pubBytes)
	}

	f.mu.Lock()
	f.cache = newCache
	f.lastFetch = time.Now()
	f.mu.Unlock()
}
