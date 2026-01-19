package safety

import (
	"sync"
	"testing"
	"time"
)

func TestMonitor_InvalidCommand_TimeWindowReset(t *testing.T) {
	triggerCount := 0
	var mu sync.Mutex

	threshold := 5
	timeWindow := 50 * time.Millisecond
	m := NewMonitor(500*time.Millisecond, threshold, timeWindow, func(trig Trigger) TransitionResult {
		mu.Lock()
		triggerCount++
		mu.Unlock()
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	// Send threshold-1 invalid commands
	for i := 0; i < threshold-1; i++ {
		m.OnInvalidCommand()
	}

	// Wait for time window to expire
	time.Sleep(timeWindow + 20*time.Millisecond)

	// Send threshold-1 more invalid commands - should not trigger (window reset)
	for i := 0; i < threshold-1; i++ {
		m.OnInvalidCommand()
	}

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	if count != 0 {
		t.Errorf("should not trigger after window reset, triggerCount=%d", count)
	}
}

func TestMonitor_InvalidCommand_WindowPreservesCount(t *testing.T) {
	var triggered Trigger

	threshold := 5
	timeWindow := 200 * time.Millisecond
	m := NewMonitor(500*time.Millisecond, threshold, timeWindow, func(trig Trigger) TransitionResult {
		triggered = trig
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	// Send threshold-1 invalid commands
	for i := 0; i < threshold-1; i++ {
		m.OnInvalidCommand()
		time.Sleep(10 * time.Millisecond) // Small delay but within window
	}

	// Should not trigger yet
	if triggered != "" {
		t.Errorf("should not trigger before threshold, got %s", triggered)
	}

	// Send one more - should trigger
	m.OnInvalidCommand()

	if triggered != TriggerInvalidCmds {
		t.Errorf("expected TriggerInvalidCmds, got %s", triggered)
	}
}

func TestMonitor_InvalidCommand_ZeroWindowDisablesFeature(t *testing.T) {
	var triggered Trigger

	threshold := 5
	timeWindow := time.Duration(0) // Disabled
	m := NewMonitor(500*time.Millisecond, threshold, timeWindow, func(trig Trigger) TransitionResult {
		triggered = trig
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	// Send threshold-1 invalid commands
	for i := 0; i < threshold-1; i++ {
		m.OnInvalidCommand()
	}

	// Wait a long time (would reset if feature was enabled)
	time.Sleep(100 * time.Millisecond)

	// Send one more - should still trigger (no window reset)
	m.OnInvalidCommand()

	if triggered != TriggerInvalidCmds {
		t.Errorf("expected TriggerInvalidCmds, got %s", triggered)
	}
}

func TestMonitor_InvalidCommand_WindowResetOnValidControl(t *testing.T) {
	triggerCount := 0
	var mu sync.Mutex

	threshold := 5
	timeWindow := 500 * time.Millisecond
	m := NewMonitor(500*time.Millisecond, threshold, timeWindow, func(trig Trigger) TransitionResult {
		mu.Lock()
		triggerCount++
		mu.Unlock()
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	// Send threshold-1 invalid commands
	for i := 0; i < threshold-1; i++ {
		m.OnInvalidCommand()
	}

	// Valid control resets count (regardless of time window)
	m.OnValidControl()

	// Send threshold-1 more - should not trigger
	for i := 0; i < threshold-1; i++ {
		m.OnInvalidCommand()
	}

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	if count != 0 {
		t.Errorf("should not trigger after valid control reset, triggerCount=%d", count)
	}
}
