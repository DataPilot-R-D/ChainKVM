package metrics

import (
	"os"
	"path/filepath"
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

	// Mock revocation function that records timestamps
	revokeFn := func(sessionID, reason string) {
		base := time.Now()
		runner.Collector().Record(RevocationTimestamps{
			SessionID:         sessionID,
			MessageReceived:   base,
			HandlerStarted:    base.Add(1 * time.Millisecond),
			SafeStopTriggered: base.Add(5 * time.Millisecond),
			SafeStopCompleted: base.Add(10 * time.Millisecond),
		})
	}

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
	revokeFn := func(sessionID, reason string) {
		base := time.Now()
		runner.Collector().Record(RevocationTimestamps{
			SessionID:         sessionID,
			MessageReceived:   base,
			SafeStopCompleted: base.Add(5 * time.Millisecond),
		})
	}

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

	// Fast revocations should pass
	revokeFn := func(sessionID, reason string) {
		base := time.Now()
		runner.Collector().Record(RevocationTimestamps{
			SessionID:         sessionID,
			MessageReceived:   base,
			SafeStopTriggered: base.Add(10 * time.Millisecond),
			SafeStopCompleted: base.Add(20 * time.Millisecond),
		})
	}

	result := runner.Run(revokeFn)

	if !result.Report.MeetsTarget {
		t.Error("fast revocations should meet LAN targets")
	}
}

func TestMeasurementResult_JSON(t *testing.T) {
	result := MeasurementResult{
		Config: DefaultLANConfig(),
		Report: RevocationReport{
			SampleCount: 10,
			MeetsTarget: true,
		},
		RunDuration: 1 * time.Second,
		StartTime:   time.Now(),
		EndTime:     time.Now(),
	}

	data, err := result.JSON()
	if err != nil {
		t.Fatalf("JSON() error: %v", err)
	}

	if len(data) == 0 {
		t.Error("JSON output should not be empty")
	}
}

func TestMeasurementResult_WriteToFile(t *testing.T) {
	result := MeasurementResult{
		Config: DefaultLANConfig(),
		Report: RevocationReport{
			SampleCount: 10,
			MeetsTarget: true,
		},
		RunDuration: 1 * time.Second,
		StartTime:   time.Now(),
		EndTime:     time.Now(),
	}

	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "result.json")

	err := result.WriteToFile(path)
	if err != nil {
		t.Fatalf("WriteToFile error: %v", err)
	}

	// Verify file exists and has content
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read file error: %v", err)
	}
	if len(data) == 0 {
		t.Error("output file should not be empty")
	}
}

func TestMeasurementResult_String(t *testing.T) {
	result := MeasurementResult{
		Config: DefaultLANConfig(),
		Report: RevocationReport{
			SampleCount: 10,
			MeetsTarget: true,
		},
		RunDuration: 1 * time.Second,
	}

	str := result.String()

	if len(str) == 0 {
		t.Error("String() should not be empty")
	}

	// Should contain key information
	if !contains(str, "lan") {
		t.Error("String() should contain profile")
	}
	if !contains(str, "PASS") {
		t.Error("String() should contain PASS for passing result")
	}
}

func TestCompareResults(t *testing.T) {
	lan := MeasurementResult{
		Config: DefaultLANConfig(),
		Report: RevocationReport{
			Total:       RevocationStats{P50: 50 * time.Millisecond, P95: 100 * time.Millisecond},
			SafeStop:    RevocationStats{Max: 20 * time.Millisecond},
			MeetsTarget: true,
		},
	}

	wan := MeasurementResult{
		Config: DefaultWANConfig(),
		Report: RevocationReport{
			Total:       RevocationStats{P50: 150 * time.Millisecond, P95: 300 * time.Millisecond},
			SafeStop:    RevocationStats{Max: 25 * time.Millisecond},
			MeetsTarget: true,
		},
	}

	comparison := CompareResults(lan, wan)

	if len(comparison) == 0 {
		t.Error("comparison should not be empty")
	}
	if !contains(comparison, "LAN Results") {
		t.Error("comparison should contain LAN section")
	}
	if !contains(comparison, "WAN Results") {
		t.Error("comparison should contain WAN section")
	}
	if !contains(comparison, "Delta") {
		t.Error("comparison should contain Delta section")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
