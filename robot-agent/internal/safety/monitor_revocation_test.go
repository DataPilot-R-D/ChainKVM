package safety

import (
	"sync"
	"testing"
	"time"
)

// TestRevocation_TriggersSafeStop verifies OnRevoked triggers safe-stop.
func TestRevocation_TriggersSafeStop(t *testing.T) {
	var triggered Trigger

	m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
		triggered = trig
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	m.OnRevoked()

	if triggered != TriggerRevoked {
		t.Errorf("expected TriggerRevoked, got %s", triggered)
	}
}

// TestRevocation_IsNonRecoverable verifies OnValidControl cannot recover from revocation.
func TestRevocation_IsNonRecoverable(t *testing.T) {
	triggerCount := 0
	var mu sync.Mutex

	m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
		mu.Lock()
		triggerCount++
		mu.Unlock()
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	// Trigger revocation
	m.OnRevoked()

	// Attempt recovery with valid control
	m.OnValidControl()

	// Try to trigger another revocation - should be ignored
	m.OnRevoked()

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	if count != 1 {
		t.Errorf("revocation should not be recoverable, expected 1 trigger, got %d", count)
	}

	// Verify IsRecoverable returns false
	if TriggerRevoked.IsRecoverable() {
		t.Error("TriggerRevoked.IsRecoverable() should return false")
	}
}

// TestRevocation_Priority verifies revocation has security priority level.
func TestRevocation_Priority(t *testing.T) {
	priority := TriggerRevoked.Priority()

	if priority != PrioritySecurity {
		t.Errorf("expected PrioritySecurity (%d), got %d", PrioritySecurity, priority)
	}

	// Security priority should be between Critical (1) and Operational (3)
	if priority <= PriorityCritical {
		t.Error("revocation priority should be lower than critical (E-Stop)")
	}
	if priority >= PriorityOperational {
		t.Error("revocation priority should be higher than operational")
	}
}

// TestRevocation_Under100ms verifies revocation completes within timing requirement.
func TestRevocation_Under100ms(t *testing.T) {
	m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
		start := time.Now()
		time.Sleep(1 * time.Millisecond) // Simulate minimal hardware latency
		return TransitionResult{
			Trigger:   trig,
			Duration:  time.Since(start),
			Timestamp: time.Now(),
		}
	})

	start := time.Now()
	m.OnRevoked()
	latency := time.Since(start)

	if latency >= 100*time.Millisecond {
		t.Errorf("revocation took %v, expected < 100ms", latency)
	}

	result := m.LastTransition()
	if result.Duration >= 100*time.Millisecond {
		t.Errorf("transition duration %v exceeds 100ms limit", result.Duration)
	}
}

// TestRevocation_ConcurrentTriggers verifies multiple concurrent revocations
// are handled safely with only one callback execution.
func TestRevocation_ConcurrentTriggers(t *testing.T) {
	triggerCount := 0
	var mu sync.Mutex

	m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
		mu.Lock()
		triggerCount++
		mu.Unlock()
		time.Sleep(1 * time.Millisecond)
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	var wg sync.WaitGroup
	for range 20 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			m.OnRevoked()
		}()
	}

	wg.Wait()

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	if count != 1 {
		t.Errorf("expected exactly 1 trigger from concurrent revocations, got %d", count)
	}
}

// TestRevocation_ClearsControlLossState verifies revocation clears any
// pending control loss state (prevents recovery).
func TestRevocation_ClearsControlLossState(t *testing.T) {
	triggerCount := 0
	var triggers []Trigger
	var mu sync.Mutex

	timeout := 30 * time.Millisecond
	m := NewMonitor(timeout, 10, 0, func(trig Trigger) TransitionResult {
		mu.Lock()
		triggerCount++
		triggers = append(triggers, trig)
		mu.Unlock()
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	// Trigger control loss
	time.Sleep(timeout + 10*time.Millisecond)
	m.CheckControlLoss()

	mu.Lock()
	if triggerCount != 1 || triggers[0] != TriggerControlLoss {
		mu.Unlock()
		t.Fatalf("expected control loss, got %d triggers: %v", triggerCount, triggers)
	}
	mu.Unlock()

	// Reconnect then immediately revoke
	m.OnValidControl()
	m.OnRevoked()

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	// Should have 2 triggers: control loss then revocation
	if count != 2 {
		t.Errorf("expected 2 triggers, got %d", count)
	}

	// After revocation, control loss should NOT be recoverable
	m.OnValidControl()
	time.Sleep(timeout + 10*time.Millisecond)
	m.CheckControlLoss() // Should not trigger - stopped by revocation

	mu.Lock()
	finalCount := triggerCount
	mu.Unlock()

	if finalCount != 2 {
		t.Errorf("expected 2 triggers after revocation stops further triggers, got %d", finalCount)
	}
}
