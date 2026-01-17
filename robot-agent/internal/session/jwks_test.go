// Package session tests for JWKS fetcher.
package session

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// createTestJWKS creates a JWKS response for a given public key.
func createTestJWKS(t *testing.T, pub ed25519.PublicKey, kid string) string {
	t.Helper()
	jwks := map[string]any{
		"keys": []map[string]any{
			{
				"kty": "OKP",
				"crv": "Ed25519",
				"kid": kid,
				"x":   base64.RawURLEncoding.EncodeToString(pub),
				"use": "sig",
			},
		},
	}
	data, err := json.Marshal(jwks)
	require.NoError(t, err)
	return string(data)
}

func TestJWKSFetcher_FetchAndParse(t *testing.T) {
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	kid := "test-key-id"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(createTestJWKS(t, pub, kid)))
	}))
	defer server.Close()

	fetcher := NewJWKSFetcher(server.URL, 1*time.Minute)

	gotPub, err := fetcher.GetPublicKey(kid)

	require.NoError(t, err)
	assert.Equal(t, pub, gotPub)
}

func TestJWKSFetcher_KeyCaching(t *testing.T) {
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	kid := "cached-key"
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(createTestJWKS(t, pub, kid)))
	}))
	defer server.Close()

	fetcher := NewJWKSFetcher(server.URL, 1*time.Minute)

	// First call fetches from server
	_, err = fetcher.GetPublicKey(kid)
	require.NoError(t, err)
	assert.Equal(t, 1, requestCount)

	// Second call uses cache
	_, err = fetcher.GetPublicKey(kid)
	require.NoError(t, err)
	assert.Equal(t, 1, requestCount) // No additional request
}

func TestJWKSFetcher_CacheMissTriggersRefresh(t *testing.T) {
	pub1, _, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)
	pub2, _, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	kid1 := "key-1"
	kid2 := "key-2"
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		// Return both keys
		jwks := map[string]any{
			"keys": []map[string]any{
				{
					"kty": "OKP",
					"crv": "Ed25519",
					"kid": kid1,
					"x":   base64.RawURLEncoding.EncodeToString(pub1),
					"use": "sig",
				},
				{
					"kty": "OKP",
					"crv": "Ed25519",
					"kid": kid2,
					"x":   base64.RawURLEncoding.EncodeToString(pub2),
					"use": "sig",
				},
			},
		}
		data, _ := json.Marshal(jwks)
		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	}))
	defer server.Close()

	fetcher := NewJWKSFetcher(server.URL, 1*time.Minute)

	// Fetch first key
	gotPub1, err := fetcher.GetPublicKey(kid1)
	require.NoError(t, err)
	assert.Equal(t, pub1, gotPub1)

	// Fetch second key (should use cached JWKS)
	gotPub2, err := fetcher.GetPublicKey(kid2)
	require.NoError(t, err)
	assert.Equal(t, pub2, gotPub2)
	assert.Equal(t, 1, requestCount) // Still only one request
}

func TestJWKSFetcher_KeyNotFound(t *testing.T) {
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(createTestJWKS(t, pub, "existing-key")))
	}))
	defer server.Close()

	fetcher := NewJWKSFetcher(server.URL, 1*time.Minute)

	_, err = fetcher.GetPublicKey("non-existent-key")

	assert.ErrorIs(t, err, ErrKeyNotFound)
}

func TestJWKSFetcher_InvalidJWKS(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("invalid json"))
	}))
	defer server.Close()

	fetcher := NewJWKSFetcher(server.URL, 1*time.Minute)

	_, err := fetcher.GetPublicKey("any-key")

	assert.Error(t, err)
}

func TestJWKSFetcher_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	fetcher := NewJWKSFetcher(server.URL, 1*time.Minute)

	_, err := fetcher.GetPublicKey("any-key")

	assert.Error(t, err)
}

func TestJWKSFetcher_Refresh(t *testing.T) {
	pub1, _, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)
	pub2, _, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	kid := "rotating-key"
	currentPub := pub1
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(createTestJWKS(t, currentPub, kid)))
	}))
	defer server.Close()

	fetcher := NewJWKSFetcher(server.URL, 1*time.Minute)

	// Fetch initial key
	gotPub1, err := fetcher.GetPublicKey(kid)
	require.NoError(t, err)
	assert.Equal(t, pub1, gotPub1)

	// Rotate key on server
	currentPub = pub2

	// Explicit refresh
	err = fetcher.Refresh()
	require.NoError(t, err)

	// Should get new key
	gotPub2, err := fetcher.GetPublicKey(kid)
	require.NoError(t, err)
	assert.Equal(t, pub2, gotPub2)
}
