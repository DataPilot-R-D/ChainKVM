package safety

import (
	"sync"
	"testing"
	"time"
)

func TestMonitor_ReconnectionAfterControlLoss(t *testing.T) {
	triggerCount := 0
	var triggers []Trigger
	var mu sync.Mutex

	timeout := 50 * time.Millisecond
	m := NewMonitor(timeout, 10, 0, func(trig Trigger) {
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
	m := NewMonitor(timeout, 10, 0, func(trig Trigger) {
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

func TestMonitor_NonRecoverableTriggers(t *testing.T) {
	tests := []struct {
		name    string
		trigger func(m *Monitor)
	}{
		{"EStop", func(m *Monitor) { m.OnEStop() }},
		{"Revoked", func(m *Monitor) { m.OnRevoked() }},
		{"TokenExpired", func(m *Monitor) { m.OnTokenExpired() }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			triggerCount := 0
			var mu sync.Mutex

			m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) {
				mu.Lock()
				triggerCount++
				mu.Unlock()
			})

			tt.trigger(m)
			time.Sleep(10 * time.Millisecond)

			m.OnValidControl()
			tt.trigger(m)
			time.Sleep(10 * time.Millisecond)

			mu.Lock()
			count := triggerCount
			mu.Unlock()

			if count != 1 {
				t.Errorf("%s should not be recoverable, expected 1 trigger, got %d", tt.name, count)
			}
		})
	}
}
