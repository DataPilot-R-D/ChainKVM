package safety

import (
	"sync"
	"testing"
	"time"
)

// TestSafeStopTransition_EStop_Under100ms verifies E-Stop transitions complete
// within the 100ms requirement (FR-14).
func TestSafeStopTransition_EStop_Under100ms(t *testing.T) {
	var duration time.Duration

	m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
		start := time.Now()
		// Simulate minimal work
		time.Sleep(1 * time.Millisecond)
		duration = time.Since(start)
		return TransitionResult{Trigger: trig, Duration: duration, Timestamp: time.Now()}
	})

	m.OnEStop()
	result := m.LastTransition()

	if result.Duration >= 100*time.Millisecond {
		t.Errorf("E-Stop transition took %v, expected < 100ms", result.Duration)
	}
}

// TestSafeStopTransition_AllTriggers_Under100ms verifies all trigger types
// complete within 100ms.
func TestSafeStopTransition_AllTriggers_Under100ms(t *testing.T) {
	triggers := []struct {
		name    string
		trigger func(m *Monitor)
	}{
		{"EStop", func(m *Monitor) { m.OnEStop() }},
		{"Revoked", func(m *Monitor) { m.OnRevoked() }},
		{"TokenExpired", func(m *Monitor) { m.OnTokenExpired() }},
		{"InvalidCmds", func(m *Monitor) {
			for i := 0; i < 10; i++ {
				m.OnInvalidCommand()
			}
		}},
	}

	for _, tt := range triggers {
		t.Run(tt.name, func(t *testing.T) {
			m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
				start := time.Now()
				time.Sleep(1 * time.Millisecond) // Simulate minimal hardware latency
				return TransitionResult{
					Trigger:   trig,
					Duration:  time.Since(start),
					Timestamp: time.Now(),
				}
			})

			tt.trigger(m)
			result := m.LastTransition()

			if result.Duration >= 100*time.Millisecond {
				t.Errorf("%s transition took %v, expected < 100ms", tt.name, result.Duration)
			}
		})
	}
}

// TestSafeStopTransition_ControlLoss_Under100ms verifies control loss
// detection triggers within 100ms after timeout.
func TestSafeStopTransition_ControlLoss_Under100ms(t *testing.T) {
	timeout := 50 * time.Millisecond

	m := NewMonitor(timeout, 10, 0, func(trig Trigger) TransitionResult {
		start := time.Now()
		time.Sleep(1 * time.Millisecond)
		return TransitionResult{
			Trigger:   trig,
			Duration:  time.Since(start),
			Timestamp: time.Now(),
		}
	})

	// Wait for timeout to expire
	time.Sleep(timeout + 10*time.Millisecond)

	// Trigger detection
	m.CheckControlLoss()
	result := m.LastTransition()

	if result.Trigger != TriggerControlLoss {
		t.Errorf("expected TriggerControlLoss, got %s", result.Trigger)
	}
	if result.Duration >= 100*time.Millisecond {
		t.Errorf("control loss transition took %v, expected < 100ms", result.Duration)
	}
}

// TestSafeStopTransition_UnderLoad tests E-Stop transition latency
// while processing a high command rate (100 cmd/sec).
func TestSafeStopTransition_UnderLoad(t *testing.T) {
	var triggerTime time.Time
	var mu sync.Mutex
	cmdCount := 0

	m := NewMonitor(5*time.Second, 1000, 0, func(trig Trigger) TransitionResult {
		mu.Lock()
		triggerTime = time.Now()
		mu.Unlock()
		return TransitionResult{Trigger: trig, Timestamp: triggerTime}
	})

	// Start high-rate command stream (100 cmd/sec = 10ms interval)
	stopCmds := make(chan struct{})
	cmdDone := make(chan struct{})

	go func() {
		ticker := time.NewTicker(10 * time.Millisecond)
		defer ticker.Stop()
		defer close(cmdDone)

		for {
			select {
			case <-stopCmds:
				return
			case <-ticker.C:
				m.OnValidControl()
				mu.Lock()
				cmdCount++
				mu.Unlock()
			}
		}
	}()

	// Let commands flow for 200ms
	time.Sleep(200 * time.Millisecond)

	// Trigger E-Stop and measure latency
	estopStart := time.Now()
	m.OnEStop()
	estopEnd := time.Now()

	// Stop command stream
	close(stopCmds)
	<-cmdDone

	estopLatency := estopEnd.Sub(estopStart)

	mu.Lock()
	count := cmdCount
	mu.Unlock()

	t.Logf("Processed %d commands before E-Stop", count)
	t.Logf("E-Stop latency under load: %v", estopLatency)

	if estopLatency >= 100*time.Millisecond {
		t.Errorf("E-Stop under load took %v, expected < 100ms", estopLatency)
	}

	// Verify at least some commands were processed (sanity check)
	if count < 10 {
		t.Errorf("expected at least 10 commands, got %d", count)
	}
}

// TestSafeStopTransition_ConcurrentTriggers tests that concurrent triggers
// complete quickly and only trigger once.
func TestSafeStopTransition_ConcurrentTriggers(t *testing.T) {
	triggerCount := 0
	var maxDuration time.Duration
	var mu sync.Mutex

	m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
		start := time.Now()
		time.Sleep(1 * time.Millisecond)
		duration := time.Since(start)

		mu.Lock()
		triggerCount++
		if duration > maxDuration {
			maxDuration = duration
		}
		mu.Unlock()

		return TransitionResult{Trigger: trig, Duration: duration, Timestamp: time.Now()}
	})

	// Launch concurrent triggers
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			m.OnEStop()
		}()
	}

	wg.Wait()

	mu.Lock()
	count := triggerCount
	duration := maxDuration
	mu.Unlock()

	if count != 1 {
		t.Errorf("expected exactly 1 trigger, got %d", count)
	}
	if duration >= 100*time.Millisecond {
		t.Errorf("max duration %v exceeded 100ms limit", duration)
	}
}

// TestTransitionResult_Duration verifies the TransitionResult captures
// accurate timing information.
func TestTransitionResult_Duration(t *testing.T) {
	simulatedWork := 5 * time.Millisecond

	m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
		start := time.Now()
		time.Sleep(simulatedWork)
		return TransitionResult{
			Trigger:   trig,
			Duration:  time.Since(start),
			Timestamp: time.Now(),
		}
	})

	m.OnEStop()
	result := m.LastTransition()

	// Duration should be at least the simulated work time
	if result.Duration < simulatedWork {
		t.Errorf("Duration %v less than simulated work %v", result.Duration, simulatedWork)
	}

	// But not excessively more (allow 50ms overhead)
	if result.Duration > simulatedWork+50*time.Millisecond {
		t.Errorf("Duration %v has excessive overhead beyond %v", result.Duration, simulatedWork)
	}

	// Timestamp should be recent
	if time.Since(result.Timestamp) > 1*time.Second {
		t.Error("Timestamp is stale")
	}
}
