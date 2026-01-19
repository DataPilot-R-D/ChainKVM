package metrics

import (
	"testing"
	"time"
)

func TestDefaultLANConfig(t *testing.T) {
	cfg := DefaultLANConfig()

	if cfg.Profile != ProfileLAN {
		t.Errorf("expected ProfileLAN, got %v", cfg.Profile)
	}
	if cfg.Iterations != 100 {
		t.Errorf("expected 100 iterations, got %d", cfg.Iterations)
	}
	if cfg.SimulatedRTT != 0 {
		t.Errorf("expected 0 RTT for LAN, got %v", cfg.SimulatedRTT)
	}
}

func TestDefaultWANConfig(t *testing.T) {
	cfg := DefaultWANConfig()

	if cfg.Profile != ProfileWAN {
		t.Errorf("expected ProfileWAN, got %v", cfg.Profile)
	}
	if cfg.SimulatedRTT != 100*time.Millisecond {
		t.Errorf("expected 100ms RTT for WAN, got %v", cfg.SimulatedRTT)
	}
}

func TestRunConfig_Targets(t *testing.T) {
	lanCfg := DefaultLANConfig()
	lanTargets := lanCfg.Targets()

	if lanTargets.TotalP95 != 1*time.Second {
		t.Errorf("LAN TotalP95: expected 1s, got %v", lanTargets.TotalP95)
	}

	wanCfg := DefaultWANConfig()
	wanTargets := wanCfg.Targets()

	if wanTargets.TotalP95 != 2*time.Second {
		t.Errorf("WAN TotalP95: expected 2s, got %v", wanTargets.TotalP95)
	}
}

func TestMeasurementRunner_Run(t *testing.T) {
	cfg := RunConfig{
		Profile:    ProfileLAN,
		Iterations: 10,
		WarmupRuns: 2,
	}
	runner := NewMeasurementRunner(cfg)

	revokeFn := newTestRevokeFn(runner.Collector())
	result := runner.Run(revokeFn)

	if result.Report.SampleCount != 10 {
		t.Errorf("expected 10 samples, got %d", result.Report.SampleCount)
	}
	if result.Config.Profile != ProfileLAN {
		t.Errorf("expected ProfileLAN, got %v", result.Config.Profile)
	}
	if result.RunDuration <= 0 {
		t.Error("run duration should be positive")
	}
}

func TestMeasurementRunner_WarmupDiscarded(t *testing.T) {
	cfg := RunConfig{
		Profile:    ProfileLAN,
		Iterations: 5,
		WarmupRuns: 3,
	}
	runner := NewMeasurementRunner(cfg)

	callCount := 0
	revokeFn := func(sessionID, reason string) {
		callCount++
		base := time.Now()
		runner.Collector().Record(RevocationTimestamps{
			SessionID:         sessionID,
			MessageReceived:   base,
			SafeStopCompleted: base.Add(10 * time.Millisecond),
		})
	}

	result := runner.Run(revokeFn)

	// Total calls = warmup + iterations
	if callCount != 8 {
		t.Errorf("expected 8 total calls (3 warmup + 5 test), got %d", callCount)
	}

	// Only iterations should be recorded after warmup reset
	if result.Report.SampleCount != 5 {
		t.Errorf("expected 5 samples (warmup discarded), got %d", result.Report.SampleCount)
	}
}

func TestMeasurementRunner_WANSimulation(t *testing.T) {
	cfg := RunConfig{
		Profile:      ProfileWAN,
		Iterations:   3,
		SimulatedRTT: 20 * time.Millisecond, // Short for test speed
		WarmupRuns:   0,
	}
	runner := NewMeasurementRunner(cfg)

	start := time.Now()
	revokeFn := newTestRevokeFn(runner.Collector())
	_ = runner.Run(revokeFn)
	elapsed := time.Since(start)

	// Should take at least (iterations * RTT/2) for simulated latency
	minExpected := 3 * 10 * time.Millisecond // 3 iterations * 10ms one-way
	if elapsed < minExpected {
		t.Errorf("WAN simulation too fast: expected >= %v, got %v", minExpected, elapsed)
	}
}

func TestMeasurementResult_MeetsTarget(t *testing.T) {
	cfg := DefaultLANConfig()
	cfg.Iterations = 10
	cfg.WarmupRuns = 0
	runner := NewMeasurementRunner(cfg)

	revokeFn := newTestRevokeFn(runner.Collector())
	result := runner.Run(revokeFn)

	if !result.Report.MeetsTarget {
		t.Error("fast revocations should meet LAN targets")
	}
}

// newTestRevokeFn creates a test revocation function that records timestamps.
func newTestRevokeFn(collector *RevocationCollector) RevocationFunc {
	return func(sessionID, reason string) {
		base := time.Now()
		collector.Record(RevocationTimestamps{
			SessionID:         sessionID,
			MessageReceived:   base,
			HandlerStarted:    base.Add(1 * time.Millisecond),
			SafeStopTriggered: base.Add(5 * time.Millisecond),
			SafeStopCompleted: base.Add(10 * time.Millisecond),
		})
	}
}
