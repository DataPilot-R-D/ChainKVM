package metrics

import (
	"encoding/json"
	"testing"
	"time"
)

func TestVideoLatencyReport_MeetsTarget(t *testing.T) {
	tests := []struct {
		name        string
		p50         time.Duration
		p95         time.Duration
		targetP50   time.Duration
		targetP95   time.Duration
		meetsTarget bool
	}{
		{
			name:        "all within targets",
			p50:         150 * time.Millisecond,
			p95:         350 * time.Millisecond,
			targetP50:   200 * time.Millisecond,
			targetP95:   400 * time.Millisecond,
			meetsTarget: true,
		},
		{
			name:        "p50 exceeds target",
			p50:         250 * time.Millisecond,
			p95:         350 * time.Millisecond,
			targetP50:   200 * time.Millisecond,
			targetP95:   400 * time.Millisecond,
			meetsTarget: false,
		},
		{
			name:        "p95 exceeds target",
			p50:         150 * time.Millisecond,
			p95:         450 * time.Millisecond,
			targetP50:   200 * time.Millisecond,
			targetP95:   400 * time.Millisecond,
			meetsTarget: false,
		},
		{
			name:        "both exceed targets",
			p50:         250 * time.Millisecond,
			p95:         450 * time.Millisecond,
			targetP50:   200 * time.Millisecond,
			targetP95:   400 * time.Millisecond,
			meetsTarget: false,
		},
		{
			name:        "exact match",
			p50:         200 * time.Millisecond,
			p95:         400 * time.Millisecond,
			targetP50:   200 * time.Millisecond,
			targetP95:   400 * time.Millisecond,
			meetsTarget: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := NewVideoLatencyCollector(100)

			// Generate 100 samples to ensure accurate percentiles
			c.mu.Lock()
			for i := 0; i < 100; i++ {
				var latency time.Duration
				if i < 50 {
					// First 50 samples <= P50
					latency = tt.p50 * time.Duration(i+1) / 50
				} else if i < 95 {
					// Next 45 samples between P50 and P95
					latency = tt.p50 + (tt.p95-tt.p50)*time.Duration(i-50)/45
				} else {
					// Last 5 samples >= P95
					latency = tt.p95 + time.Duration(i-95)*time.Millisecond
				}
				c.samples = append(c.samples, VideoLatencySample{
					FrameTimestamp: time.Now(),
					Extracted:      time.Now().Add(latency),
					Latency:        latency,
				})
			}
			c.mu.Unlock()

			report := c.GenerateReport(VideoLatencyTargets{
				P50: tt.targetP50,
				P95: tt.targetP95,
			})

			// Check if meets target
			if report.MeetsTarget != tt.meetsTarget {
				t.Errorf("Expected MeetsTarget=%v, got %v (P50: %v vs %v, P95: %v vs %v)",
					tt.meetsTarget, report.MeetsTarget,
					report.Stats.P50, tt.targetP50,
					report.Stats.P95, tt.targetP95)
			}
		})
	}
}

func TestVideoLatencyReport_JSON(t *testing.T) {
	c := NewVideoLatencyCollector(100)

	// Generate predictable samples
	c.mu.Lock()
	now := time.Now()
	c.samples = []VideoLatencySample{
		{FrameTimestamp: now, Extracted: now.Add(100 * time.Millisecond), Latency: 100 * time.Millisecond},
		{FrameTimestamp: now, Extracted: now.Add(150 * time.Millisecond), Latency: 150 * time.Millisecond},
		{FrameTimestamp: now, Extracted: now.Add(200 * time.Millisecond), Latency: 200 * time.Millisecond},
	}
	c.mu.Unlock()

	report := c.GenerateReport(DefaultVideoLatencyTargets())

	// Marshal to JSON
	data, err := json.Marshal(report)
	if err != nil {
		t.Fatalf("Failed to marshal report to JSON: %v", err)
	}

	// Unmarshal to verify structure
	var decoded VideoLatencyReport
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	// Verify fields
	if decoded.SampleCount != 3 {
		t.Errorf("Expected SampleCount 3, got %d", decoded.SampleCount)
	}
	if decoded.Stats.Count != 3 {
		t.Errorf("Expected Stats.Count 3, got %d", decoded.Stats.Count)
	}
	if decoded.Targets.P50 != 200*time.Millisecond {
		t.Errorf("Expected Targets.P50 200ms, got %v", decoded.Targets.P50)
	}
	if decoded.Targets.P95 != 400*time.Millisecond {
		t.Errorf("Expected Targets.P95 400ms, got %v", decoded.Targets.P95)
	}
}

func TestVideoLatencyCollector_GenerateReport(t *testing.T) {
	c := NewVideoLatencyCollector(100)

	// Generate samples with known latencies
	latencies := []time.Duration{
		100 * time.Millisecond,
		150 * time.Millisecond,
		200 * time.Millisecond,
		250 * time.Millisecond,
		300 * time.Millisecond,
	}

	for _, lat := range latencies {
		c.RecordLatency(lat)
	}

	targets := VideoLatencyTargets{
		P50: 250 * time.Millisecond,
		P95: 350 * time.Millisecond,
	}

	report := c.GenerateReport(targets)

	// Verify report structure
	if report.SampleCount != len(latencies) {
		t.Errorf("Expected SampleCount %d, got %d", len(latencies), report.SampleCount)
	}
	if report.Stats.Count != len(latencies) {
		t.Errorf("Expected Stats.Count %d, got %d", len(latencies), report.Stats.Count)
	}
	if report.Targets.P50 != targets.P50 {
		t.Errorf("Expected Targets.P50 %v, got %v", targets.P50, report.Targets.P50)
	}
	if report.Targets.P95 != targets.P95 {
		t.Errorf("Expected Targets.P95 %v, got %v", targets.P95, report.Targets.P95)
	}

	// Check GeneratedAt is recent
	if time.Since(report.GeneratedAt) > 1*time.Second {
		t.Errorf("GeneratedAt timestamp seems old: %v", report.GeneratedAt)
	}

	// Check stats
	if report.Stats.Min != 100*time.Millisecond {
		t.Errorf("Expected Min 100ms, got %v", report.Stats.Min)
	}
	if report.Stats.Max != 300*time.Millisecond {
		t.Errorf("Expected Max 300ms, got %v", report.Stats.Max)
	}
	if report.Stats.P50 != 200*time.Millisecond {
		t.Errorf("Expected P50 200ms, got %v", report.Stats.P50)
	}

	// Check meets target
	// P50 = 200ms <= 250ms target ✓
	// P95 = 300ms <= 350ms target ✓
	if !report.MeetsTarget {
		t.Errorf("Expected MeetsTarget=true (P50: %v <= %v, P95: %v <= %v)",
			report.Stats.P50, targets.P50,
			report.Stats.P95, targets.P95)
	}
}

func TestVideoLatencyReport_JSONMethod(t *testing.T) {
	c := NewVideoLatencyCollector(100)

	// Add samples
	c.RecordLatency(100 * time.Millisecond)
	c.RecordLatency(200 * time.Millisecond)

	report := c.GenerateReport(DefaultVideoLatencyTargets())

	// Test JSON() method
	jsonData, err := report.JSON()
	if err != nil {
		t.Fatalf("JSON() method failed: %v", err)
	}

	// Verify it's valid JSON
	var decoded VideoLatencyReport
	if err := json.Unmarshal(jsonData, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal JSON from JSON() method: %v", err)
	}

	// Verify data matches
	if decoded.SampleCount != report.SampleCount {
		t.Errorf("Decoded SampleCount %d != original %d", decoded.SampleCount, report.SampleCount)
	}
	if decoded.Stats.Min != report.Stats.Min {
		t.Errorf("Decoded Stats.Min %v != original %v", decoded.Stats.Min, report.Stats.Min)
	}
}
