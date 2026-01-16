package control

import (
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

func TestRateLimiter_Allow(t *testing.T) {
	// 10 Hz limit = 1 token every 100ms
	rl := NewRateLimiter(10)

	// First request should always succeed
	if !rl.Allow(protocol.TypeDrive) {
		t.Error("first request should be allowed")
	}

	// Rapid second request should be denied
	if rl.Allow(protocol.TypeDrive) {
		t.Error("rapid second request should be denied")
	}

	// Wait for token to refill
	time.Sleep(110 * time.Millisecond)

	if !rl.Allow(protocol.TypeDrive) {
		t.Error("request after wait should be allowed")
	}
}

func TestRateLimiter_BurstCapacity(t *testing.T) {
	// 50 Hz limit with burst capacity
	rl := NewRateLimiter(50)

	// Should allow burst up to capacity
	allowed := 0
	for i := 0; i < 10; i++ {
		if rl.Allow(protocol.TypeDrive) {
			allowed++
		}
	}

	// Should allow at least 1 (initial token)
	if allowed < 1 {
		t.Errorf("expected at least 1 allowed, got %d", allowed)
	}
}

func TestRateLimiter_DifferentTypes(t *testing.T) {
	rl := NewRateLimiter(10)

	// Drive request
	if !rl.Allow(protocol.TypeDrive) {
		t.Error("first drive should be allowed")
	}

	// KVM request should have separate bucket
	if !rl.Allow(protocol.TypeKVMKey) {
		t.Error("first kvm_key should be allowed (separate bucket)")
	}

	// Another drive should be rate limited
	if rl.Allow(protocol.TypeDrive) {
		t.Error("second drive should be rate limited")
	}
}

func TestRateLimiter_EStopBypassesLimit(t *testing.T) {
	rl := NewRateLimiter(1) // Very restrictive

	// Use up the token
	rl.Allow(protocol.TypeDrive)

	// E-Stop should always be allowed (safety critical)
	for i := 0; i < 10; i++ {
		if !rl.Allow(protocol.TypeEStop) {
			t.Error("e-stop should always be allowed")
		}
	}
}

func TestRateLimiter_SustainedRate(t *testing.T) {
	// Test sustained 20 Hz rate (50ms between requests)
	rl := NewRateLimiter(20)

	start := time.Now()
	allowed := 0
	denied := 0

	// Run for 500ms at ~25 Hz (faster than limit)
	for time.Since(start) < 500*time.Millisecond {
		if rl.Allow(protocol.TypeDrive) {
			allowed++
		} else {
			denied++
		}
		time.Sleep(40 * time.Millisecond) // 25 Hz
	}

	// Should allow roughly 10 at 20 Hz over 500ms
	// Allow variance due to timing (5-15 is reasonable)
	if allowed < 5 || allowed > 15 {
		t.Errorf("expected ~10 allowed, got %d (denied: %d)", allowed, denied)
	}
}

func TestRateLimiterConfig_Apply(t *testing.T) {
	cfg := RateLimiterConfig{
		DriveHz: 50,
		KVMHz:   100,
		EStopHz: 10, // E-stop is special cased to always allow
	}

	rl := NewRateLimiterWithConfig(cfg)

	// Test that config is applied
	if rl.limits[protocol.TypeDrive] != 50 {
		t.Errorf("expected drive limit 50, got %d", rl.limits[protocol.TypeDrive])
	}

	if rl.limits[protocol.TypeKVMKey] != 100 {
		t.Errorf("expected kvm limit 100, got %d", rl.limits[protocol.TypeKVMKey])
	}
}

func TestRateLimiter_Reset(t *testing.T) {
	rl := NewRateLimiter(10)

	// Use up all tokens
	rl.Allow(protocol.TypeDrive)

	// Should be rate limited
	if rl.Allow(protocol.TypeDrive) {
		t.Error("should be rate limited before reset")
	}

	// Reset should restore tokens
	rl.Reset()

	// Should be allowed after reset
	if !rl.Allow(protocol.TypeDrive) {
		t.Error("should be allowed after reset")
	}
}

func TestRateLimiter_UnknownType(t *testing.T) {
	rl := NewRateLimiter(10)

	// Unknown message type should be allowed by default
	if !rl.Allow(protocol.TypePing) {
		t.Error("unknown type should be allowed by default")
	}
}

func TestRateLimiterConfig_BurstSize(t *testing.T) {
	cfg := RateLimiterConfig{
		DriveHz:   10,
		KVMHz:     10,
		EStopHz:   10,
		BurstSize: 5, // Allow burst of 5 commands
	}

	rl := NewRateLimiterWithConfig(cfg)

	// Should allow burst of 5 rapid requests
	allowed := 0
	for i := 0; i < 10; i++ {
		if rl.Allow(protocol.TypeDrive) {
			allowed++
		}
	}

	// Should have allowed exactly 5 (burst capacity)
	if allowed != 5 {
		t.Errorf("expected 5 allowed with burst size 5, got %d", allowed)
	}
}

func TestRateLimiterConfig_BurstSizeDefault(t *testing.T) {
	cfg := RateLimiterConfig{
		DriveHz:   10,
		KVMHz:     10,
		EStopHz:   10,
		BurstSize: 0, // Should default to 1
	}

	rl := NewRateLimiterWithConfig(cfg)

	// First request allowed
	if !rl.Allow(protocol.TypeDrive) {
		t.Error("first request should be allowed")
	}

	// Second rapid request denied (burst size defaulted to 1)
	if rl.Allow(protocol.TypeDrive) {
		t.Error("second rapid request should be denied with default burst size")
	}
}

func TestRateLimiterConfig_LogDenials(t *testing.T) {
	cfg := RateLimiterConfig{
		DriveHz:    10,
		KVMHz:      10,
		EStopHz:    10,
		BurstSize:  1,
		LogDenials: true,
	}

	rl := NewRateLimiterWithConfig(cfg)

	// Verify logDenials is set
	if !rl.logDenials {
		t.Error("logDenials should be true")
	}

	// Use up token and trigger denial (log output verified manually or via log capture)
	rl.Allow(protocol.TypeDrive)
	rl.Allow(protocol.TypeDrive) // This should log
}

func TestRateLimiter_BurstRefill(t *testing.T) {
	cfg := RateLimiterConfig{
		DriveHz:   100, // 100 Hz = 10ms per token
		KVMHz:     100,
		EStopHz:   100,
		BurstSize: 3,
	}

	rl := NewRateLimiterWithConfig(cfg)

	// Use all burst tokens
	for i := 0; i < 3; i++ {
		if !rl.Allow(protocol.TypeDrive) {
			t.Errorf("burst request %d should be allowed", i+1)
		}
	}

	// Should be rate limited
	if rl.Allow(protocol.TypeDrive) {
		t.Error("should be rate limited after burst exhausted")
	}

	// Wait for partial refill (30ms = 3 tokens at 100 Hz)
	time.Sleep(35 * time.Millisecond)

	// Should allow at least 2-3 more requests after refill
	allowed := 0
	for i := 0; i < 5; i++ {
		if rl.Allow(protocol.TypeDrive) {
			allowed++
		}
	}

	if allowed < 2 {
		t.Errorf("expected at least 2 allowed after refill, got %d", allowed)
	}
}
