package safety

import (
	"sync"
	"testing"
	"time"
)

func TestMonitor_OnEStop(t *testing.T) {
	var triggered Trigger
	var wg sync.WaitGroup
	wg.Add(1)

	m := NewMonitor(500*time.Millisecond, 10, func(trig Trigger) {
		triggered = trig
		wg.Done()
	})

	m.OnEStop()
	wg.Wait()

	if triggered != TriggerEStop {
		t.Errorf("expected TriggerEStop, got %s", triggered)
	}
}

func TestMonitor_OnInvalidCommand_Threshold(t *testing.T) {
	var triggered Trigger
	var wg sync.WaitGroup
	wg.Add(1)

	threshold := 5
	m := NewMonitor(500*time.Millisecond, threshold, func(trig Trigger) {
		triggered = trig
		wg.Done()
	})

	// Send threshold-1 invalid commands - should not trigger
	for i := 0; i < threshold-1; i++ {
		m.OnInvalidCommand()
	}

	// Give a moment for any async trigger (should not happen)
	time.Sleep(10 * time.Millisecond)

	if triggered != "" {
		t.Errorf("should not trigger before threshold, got %s", triggered)
	}

	// Send one more to reach threshold
	m.OnInvalidCommand()
	wg.Wait()

	if triggered != TriggerInvalidCmds {
		t.Errorf("expected TriggerInvalidCmds, got %s", triggered)
	}
}

func TestMonitor_OnValidControl_ResetsInvalidCount(t *testing.T) {
	triggerCount := 0
	m := NewMonitor(500*time.Millisecond, 5, func(trig Trigger) {
		triggerCount++
	})

	// Send 4 invalid commands
	for i := 0; i < 4; i++ {
		m.OnInvalidCommand()
	}

	// Valid control resets the count
	m.OnValidControl()

	// Send 4 more invalid commands - should still not trigger
	for i := 0; i < 4; i++ {
		m.OnInvalidCommand()
	}

	time.Sleep(10 * time.Millisecond)

	if triggerCount != 0 {
		t.Errorf("should not trigger after reset, triggerCount=%d", triggerCount)
	}
}

func TestMonitor_CheckControlLoss(t *testing.T) {
	var triggered Trigger
	var wg sync.WaitGroup
	wg.Add(1)

	timeout := 100 * time.Millisecond
	m := NewMonitor(timeout, 10, func(trig Trigger) {
		triggered = trig
		wg.Done()
	})

	// Initial state - should not trigger
	m.CheckControlLoss()
	time.Sleep(10 * time.Millisecond)

	if triggered != "" {
		t.Errorf("should not trigger immediately, got %s", triggered)
	}

	// Wait past timeout
	time.Sleep(timeout + 50*time.Millisecond)
	m.CheckControlLoss()
	wg.Wait()

	if triggered != TriggerControlLoss {
		t.Errorf("expected TriggerControlLoss, got %s", triggered)
	}
}

func TestMonitor_OnValidControl_ResetsControlLossTimer(t *testing.T) {
	triggerCount := 0
	timeout := 100 * time.Millisecond
	m := NewMonitor(timeout, 10, func(trig Trigger) {
		triggerCount++
	})

	// Wait half the timeout
	time.Sleep(timeout / 2)

	// Send valid control - should reset timer
	m.OnValidControl()

	// Wait half the timeout again
	time.Sleep(timeout / 2)

	// Check - should not trigger since timer was reset
	m.CheckControlLoss()
	time.Sleep(10 * time.Millisecond)

	if triggerCount != 0 {
		t.Errorf("should not trigger after control reset, triggerCount=%d", triggerCount)
	}
}

func TestMonitor_OnTokenExpired(t *testing.T) {
	var triggered Trigger
	var wg sync.WaitGroup
	wg.Add(1)

	m := NewMonitor(500*time.Millisecond, 10, func(trig Trigger) {
		triggered = trig
		wg.Done()
	})

	m.OnTokenExpired()
	wg.Wait()

	if triggered != TriggerTokenExpired {
		t.Errorf("expected TriggerTokenExpired, got %s", triggered)
	}
}

func TestMonitor_OnRevoked(t *testing.T) {
	var triggered Trigger
	var wg sync.WaitGroup
	wg.Add(1)

	m := NewMonitor(500*time.Millisecond, 10, func(trig Trigger) {
		triggered = trig
		wg.Done()
	})

	m.OnRevoked()
	wg.Wait()

	if triggered != TriggerRevoked {
		t.Errorf("expected TriggerRevoked, got %s", triggered)
	}
}

func TestMonitor_OnlyTriggersOnce(t *testing.T) {
	triggerCount := 0
	var mu sync.Mutex

	m := NewMonitor(500*time.Millisecond, 5, func(trig Trigger) {
		mu.Lock()
		triggerCount++
		mu.Unlock()
	})

	// Trigger multiple times
	m.OnEStop()
	m.OnEStop()
	m.OnRevoked()
	m.OnTokenExpired()

	time.Sleep(50 * time.Millisecond)

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	if count != 1 {
		t.Errorf("should only trigger once, triggerCount=%d", count)
	}
}

func TestMonitor_Reset(t *testing.T) {
	triggerCount := 0
	var mu sync.Mutex

	m := NewMonitor(500*time.Millisecond, 5, func(trig Trigger) {
		mu.Lock()
		triggerCount++
		mu.Unlock()
	})

	// Trigger e-stop
	m.OnEStop()
	time.Sleep(10 * time.Millisecond)

	// Reset
	m.Reset()

	// Should be able to trigger again
	m.OnEStop()
	time.Sleep(10 * time.Millisecond)

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	if count != 2 {
		t.Errorf("should trigger twice after reset, triggerCount=%d", count)
	}
}

func TestMonitor_NoCallbackIfNil(t *testing.T) {
	// Should not panic with nil callback
	m := NewMonitor(500*time.Millisecond, 10, nil)

	// These should not panic
	m.OnEStop()
	m.OnInvalidCommand()
	m.OnValidControl()
	m.CheckControlLoss()
}

func TestMonitor_ReconnectionAfterControlLoss(t *testing.T) {
	triggerCount := 0
	var triggers []Trigger
	var mu sync.Mutex

	timeout := 50 * time.Millisecond
	m := NewMonitor(timeout, 10, func(trig Trigger) {
		mu.Lock()
		triggerCount++
		triggers = append(triggers, trig)
		mu.Unlock()
	})

	// Wait for control loss
	time.Sleep(timeout + 20*time.Millisecond)
	m.CheckControlLoss()
	time.Sleep(10 * time.Millisecond)

	mu.Lock()
	if triggerCount != 1 || triggers[0] != TriggerControlLoss {
		mu.Unlock()
		t.Fatalf("expected 1 control loss trigger, got %d triggers: %v", triggerCount, triggers)
	}
	mu.Unlock()

	// Reconnect - send valid control
	m.OnValidControl()

	// Wait for another control loss
	time.Sleep(timeout + 20*time.Millisecond)
	m.CheckControlLoss()
	time.Sleep(10 * time.Millisecond)

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	// Should have triggered again after reconnection
	if count != 2 {
		t.Errorf("expected 2 triggers after reconnection, got %d", count)
	}
}

func TestMonitor_MultipleLossRecoveryCycles(t *testing.T) {
	triggerCount := 0
	var mu sync.Mutex

	timeout := 30 * time.Millisecond
	m := NewMonitor(timeout, 10, func(trig Trigger) {
		mu.Lock()
		triggerCount++
		mu.Unlock()
	})

	// Perform 3 loss/recovery cycles
	for i := 0; i < 3; i++ {
		// Wait for control loss
		time.Sleep(timeout + 10*time.Millisecond)
		m.CheckControlLoss()
		time.Sleep(5 * time.Millisecond)

		// Recover
		m.OnValidControl()
	}

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	if count != 3 {
		t.Errorf("expected 3 triggers from 3 loss cycles, got %d", count)
	}
}

func TestMonitor_EStopNotRecoverable(t *testing.T) {
	triggerCount := 0
	var mu sync.Mutex

	m := NewMonitor(500*time.Millisecond, 10, func(trig Trigger) {
		mu.Lock()
		triggerCount++
		mu.Unlock()
	})

	// E-Stop trigger
	m.OnEStop()
	time.Sleep(10 * time.Millisecond)

	// Try to recover with valid control
	m.OnValidControl()

	// Try to trigger again
	m.OnEStop()
	time.Sleep(10 * time.Millisecond)

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	// E-Stop is not recoverable (unlike control loss)
	if count != 1 {
		t.Errorf("e-stop should not be recoverable, expected 1 trigger, got %d", count)
	}
}

func TestMonitor_RevokedNotRecoverable(t *testing.T) {
	triggerCount := 0
	var mu sync.Mutex

	m := NewMonitor(500*time.Millisecond, 10, func(trig Trigger) {
		mu.Lock()
		triggerCount++
		mu.Unlock()
	})

	// Revoked trigger
	m.OnRevoked()
	time.Sleep(10 * time.Millisecond)

	// Try to recover with valid control
	m.OnValidControl()

	// Try to trigger again
	m.OnRevoked()
	time.Sleep(10 * time.Millisecond)

	mu.Lock()
	count := triggerCount
	mu.Unlock()

	// Revoked is not recoverable
	if count != 1 {
		t.Errorf("revoked should not be recoverable, expected 1 trigger, got %d", count)
	}
}
