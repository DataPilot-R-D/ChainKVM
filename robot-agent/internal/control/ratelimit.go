// Package control implements control command handling for the Robot Agent.
package control

import (
	"sync"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// RateLimiterConfig holds rate limits for different command types.
type RateLimiterConfig struct {
	DriveHz int
	KVMHz   int
	EStopHz int // Note: E-stop always bypasses rate limiting for safety
}

// tokenBucket implements a simple token bucket rate limiter.
type tokenBucket struct {
	mu         sync.Mutex
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
}

func newTokenBucket(hz int) *tokenBucket {
	return &tokenBucket{
		tokens:     1, // Start with 1 token
		maxTokens:  1, // No burst beyond 1
		refillRate: float64(hz),
		lastRefill: time.Now(),
	}
}

func (b *tokenBucket) allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.lastRefill = now

	// Refill tokens based on elapsed time
	b.tokens += elapsed * b.refillRate
	if b.tokens > b.maxTokens {
		b.tokens = b.maxTokens
	}

	// Check if we have a token available
	if b.tokens >= 1 {
		b.tokens--
		return true
	}

	return false
}

// RateLimiter enforces rate limits on control commands.
type RateLimiter struct {
	mu      sync.RWMutex
	buckets map[protocol.MessageType]*tokenBucket
	limits  map[protocol.MessageType]int
}

// NewRateLimiter creates a rate limiter with a default Hz for all types.
func NewRateLimiter(defaultHz int) *RateLimiter {
	return NewRateLimiterWithConfig(RateLimiterConfig{
		DriveHz: defaultHz,
		KVMHz:   defaultHz,
		EStopHz: defaultHz,
	})
}

// NewRateLimiterWithConfig creates a rate limiter with specific config.
func NewRateLimiterWithConfig(cfg RateLimiterConfig) *RateLimiter {
	rl := &RateLimiter{
		buckets: make(map[protocol.MessageType]*tokenBucket),
		limits:  make(map[protocol.MessageType]int),
	}

	// Configure buckets for each type
	rl.buckets[protocol.TypeDrive] = newTokenBucket(cfg.DriveHz)
	rl.limits[protocol.TypeDrive] = cfg.DriveHz

	rl.buckets[protocol.TypeKVMKey] = newTokenBucket(cfg.KVMHz)
	rl.limits[protocol.TypeKVMKey] = cfg.KVMHz

	rl.buckets[protocol.TypeKVMMouse] = newTokenBucket(cfg.KVMHz)
	rl.limits[protocol.TypeKVMMouse] = cfg.KVMHz

	rl.buckets[protocol.TypeEStop] = newTokenBucket(cfg.EStopHz)
	rl.limits[protocol.TypeEStop] = cfg.EStopHz

	return rl
}

// Allow checks if a command of the given type is allowed.
// E-stop always returns true for safety.
func (rl *RateLimiter) Allow(msgType protocol.MessageType) bool {
	// E-stop always bypasses rate limiting for safety
	if msgType == protocol.TypeEStop {
		return true
	}

	rl.mu.RLock()
	bucket, ok := rl.buckets[msgType]
	rl.mu.RUnlock()

	if !ok {
		// Unknown type, allow by default
		return true
	}

	return bucket.allow()
}

// Reset resets all rate limiters (e.g., for new session).
func (rl *RateLimiter) Reset() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	for _, bucket := range rl.buckets {
		bucket.mu.Lock()
		bucket.tokens = bucket.maxTokens
		bucket.lastRefill = time.Now()
		bucket.mu.Unlock()
	}
}
