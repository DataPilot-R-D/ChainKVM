package metrics

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

func TestDefaultControlRTTTargets(t *testing.T) {
	targets := DefaultControlRTTTargets()

	expectedP50 := 50 * time.Millisecond
	expectedP95 := 150 * time.Millisecond

	if targets.P50 != expectedP50 {
		t.Errorf("Expected P50 target %v, got %v", expectedP50, targets.P50)
	}
	if targets.P95 != expectedP95 {
		t.Errorf("Expected P95 target %v, got %v", expectedP95, targets.P95)
	}
}

func TestControlRTTReport_MeetsTarget(t *testing.T) {
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
			p50:         30 * time.Millisecond,
			p95:         100 * time.Millisecond,
			targetP50:   50 * time.Millisecond,
			targetP95:   150 * time.Millisecond,
			meetsTarget: true,
		},
		{
			name:        "p50 exceeds target",
			p50:         60 * time.Millisecond,
			p95:         100 * time.Millisecond,
			targetP50:   50 * time.Millisecond,
			targetP95:   150 * time.Millisecond,
			meetsTarget: false,
		},
		{
			name:        "p95 exceeds target",
			p50:         30 * time.Millisecond,
			p95:         200 * time.Millisecond,
			targetP50:   50 * time.Millisecond,
			targetP95:   150 * time.Millisecond,
			meetsTarget: false,
		},
		{
			name:        "both exceed targets",
			p50:         60 * time.Millisecond,
			p95:         200 * time.Millisecond,
			targetP50:   50 * time.Millisecond,
			targetP95:   150 * time.Millisecond,
			meetsTarget: false,
		},
		{
			name:        "exact match",
			p50:         50 * time.Millisecond,
			p95:         150 * time.Millisecond,
			targetP50:   50 * time.Millisecond,
			targetP95:   150 * time.Millisecond,
			meetsTarget: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := NewControlRTTCollector(100)

			// Generate 100 samples to ensure accurate percentiles
			// Create distribution where P50 and P95 match expected values
			c.mu.Lock()
			for i := 0; i < 100; i++ {
				var rtt time.Duration
				if i < 50 {
					// First 50 samples <= P50
					rtt = tt.p50 * time.Duration(i+1) / 50
				} else if i < 95 {
					// Next 45 samples between P50 and P95
					rtt = tt.p50 + (tt.p95-tt.p50)*time.Duration(i-50)/45
				} else {
					// Last 5 samples >= P95
					rtt = tt.p95 + time.Duration(i-95)*time.Millisecond
				}
				c.samples = append(c.samples, ControlRTTSample{
					Seq:      uint32(i),
					SendTime: int64(i * 1000),
					RecvTime: int64(i*1000) + rtt.Nanoseconds(),
					RTT:      rtt,
				})
			}
			c.mu.Unlock()

			report := c.GenerateReport(ControlRTTTargets{
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

func TestControlRTTReport_String(t *testing.T) {
	c := NewControlRTTCollector(100)

	// Generate some RTT samples
	for i := 0; i < 10; i++ {
		ping := c.GeneratePing()
		delay := time.Duration(10+i*5) * time.Millisecond
		time.Sleep(delay)
		pong := &protocol.PongMessage{
			Type:  protocol.TypePong,
			Seq:   ping.Seq,
			TMono: ping.TMono,
			TRecv: time.Now().UnixNano(),
		}
		c.RecordPong(pong)
	}

	report := c.GenerateReport(DefaultControlRTTTargets())
	reportStr := report.String()

	// Check for expected content
	expectedParts := []string{
		"Control RTT Report",
		"Generated:",
		"Sample Count:",
		"Statistics:",
		"P50:",
		"P95:",
		"P99:",
		"Min:",
		"Max:",
		"Avg:",
		"Meets Target:",
		"Targets:",
	}

	for _, part := range expectedParts {
		if !strings.Contains(reportStr, part) {
			t.Errorf("Expected report to contain '%s', but it doesn't.\nReport:\n%s", part, reportStr)
		}
	}
}

func TestControlRTTReport_StringEmpty(t *testing.T) {
	c := NewControlRTTCollector(100)
	report := c.GenerateReport(DefaultControlRTTTargets())
	reportStr := report.String()

	// Should handle empty samples gracefully
	if !strings.Contains(reportStr, "Sample Count: 0") {
		t.Errorf("Expected 'Sample Count: 0' in empty report, got:\n%s", reportStr)
	}
}

func TestControlRTTReport_JSON(t *testing.T) {
	c := NewControlRTTCollector(100)

	// Generate predictable samples
	c.mu.Lock()
	c.samples = []ControlRTTSample{
		{Seq: 0, SendTime: 1000, RecvTime: 1020, RTT: 20 * time.Millisecond},
		{Seq: 1, SendTime: 2000, RecvTime: 2030, RTT: 30 * time.Millisecond},
		{Seq: 2, SendTime: 3000, RecvTime: 3040, RTT: 40 * time.Millisecond},
	}
	c.mu.Unlock()

	report := c.GenerateReport(DefaultControlRTTTargets())

	// Marshal to JSON
	data, err := json.Marshal(report)
	if err != nil {
		t.Fatalf("Failed to marshal report to JSON: %v", err)
	}

	// Unmarshal to verify structure
	var decoded ControlRTTReport
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
	if decoded.Targets.P50 != 50*time.Millisecond {
		t.Errorf("Expected Targets.P50 50ms, got %v", decoded.Targets.P50)
	}
	if decoded.Targets.P95 != 150*time.Millisecond {
		t.Errorf("Expected Targets.P95 150ms, got %v", decoded.Targets.P95)
	}
}

func TestControlRTTCollector_GenerateReport(t *testing.T) {
	c := NewControlRTTCollector(100)

	// Generate samples with known RTTs
	rtts := []time.Duration{
		10 * time.Millisecond,
		20 * time.Millisecond,
		30 * time.Millisecond,
		40 * time.Millisecond,
		50 * time.Millisecond,
	}

	for i, rtt := range rtts {
		c.mu.Lock()
		c.samples = append(c.samples, ControlRTTSample{
			Seq:      uint32(i),
			SendTime: int64(i * 1000),
			RecvTime: int64(i*1000) + rtt.Nanoseconds(),
			RTT:      rtt,
		})
		c.mu.Unlock()
	}

	targets := ControlRTTTargets{
		P50: 40 * time.Millisecond,
		P95: 60 * time.Millisecond,
	}

	report := c.GenerateReport(targets)

	// Verify report structure
	if report.SampleCount != len(rtts) {
		t.Errorf("Expected SampleCount %d, got %d", len(rtts), report.SampleCount)
	}
	if report.Stats.Count != len(rtts) {
		t.Errorf("Expected Stats.Count %d, got %d", len(rtts), report.Stats.Count)
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
	if report.Stats.Min != 10*time.Millisecond {
		t.Errorf("Expected Min 10ms, got %v", report.Stats.Min)
	}
	if report.Stats.Max != 50*time.Millisecond {
		t.Errorf("Expected Max 50ms, got %v", report.Stats.Max)
	}
	if report.Stats.P50 != 30*time.Millisecond {
		t.Errorf("Expected P50 30ms, got %v", report.Stats.P50)
	}

	// Check meets target
	// P50 = 30ms <= 40ms target ✓
	// P95 = 50ms <= 60ms target ✓
	if !report.MeetsTarget {
		t.Errorf("Expected MeetsTarget=true (P50: %v <= %v, P95: %v <= %v)",
			report.Stats.P50, targets.P50,
			report.Stats.P95, targets.P95)
	}
}
