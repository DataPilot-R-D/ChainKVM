package safety

import (
	"testing"
	"time"
)

// BenchmarkSafeStopTransition_EStop measures the pure E-Stop transition latency.
func BenchmarkSafeStopTransition_EStop(b *testing.B) {
	for i := 0; i < b.N; i++ {
		m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
			return TransitionResult{Trigger: trig, Timestamp: time.Now()}
		})
		m.OnEStop()
	}
}

// BenchmarkSafeStopTransition_WithSimulatedHardware measures transition
// latency with simulated hardware delay.
func BenchmarkSafeStopTransition_WithSimulatedHardware(b *testing.B) {
	hardwareDelay := 1 * time.Millisecond

	for i := 0; i < b.N; i++ {
		m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
			start := time.Now()
			time.Sleep(hardwareDelay)
			return TransitionResult{
				Trigger:   trig,
				Duration:  time.Since(start),
				Timestamp: time.Now(),
			}
		})
		m.OnEStop()
	}
}

// BenchmarkMonitor_OnValidControl measures the overhead of valid control handling.
func BenchmarkMonitor_OnValidControl(b *testing.B) {
	m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		m.OnValidControl()
	}
}

// BenchmarkMonitor_OnInvalidCommand measures the overhead of invalid command handling.
func BenchmarkMonitor_OnInvalidCommand(b *testing.B) {
	// Use very high threshold to prevent triggering
	m := NewMonitor(500*time.Millisecond, 1000000, 0, func(trig Trigger) TransitionResult {
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		m.OnInvalidCommand()
		if i%1000 == 0 {
			m.OnValidControl() // Reset counter periodically
		}
	}
}

// BenchmarkMonitor_CheckControlLoss measures the overhead of periodic loss checking.
func BenchmarkMonitor_CheckControlLoss(b *testing.B) {
	m := NewMonitor(500*time.Millisecond, 10, 0, func(trig Trigger) TransitionResult {
		return TransitionResult{Trigger: trig, Timestamp: time.Now()}
	})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		m.OnValidControl() // Keep resetting to avoid triggering
		m.CheckControlLoss()
	}
}

// BenchmarkTriggerPriority measures the overhead of priority lookup.
func BenchmarkTriggerPriority(b *testing.B) {
	triggers := []Trigger{
		TriggerEStop,
		TriggerRevoked,
		TriggerTokenExpired,
		TriggerControlLoss,
		TriggerInvalidCmds,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = triggers[i%len(triggers)].Priority()
	}
}

// BenchmarkTriggerIsRecoverable measures the overhead of recoverability check.
func BenchmarkTriggerIsRecoverable(b *testing.B) {
	triggers := []Trigger{
		TriggerEStop,
		TriggerRevoked,
		TriggerTokenExpired,
		TriggerControlLoss,
		TriggerInvalidCmds,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = triggers[i%len(triggers)].IsRecoverable()
	}
}
