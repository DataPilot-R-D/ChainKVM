package metrics

import (
	"strings"
	"testing"
	"time"
)

func TestDefaultVideoLatencyTargets(t *testing.T) {
	targets := DefaultVideoLatencyTargets()

	expectedP50 := 200 * time.Millisecond
	expectedP95 := 400 * time.Millisecond

	if targets.P50 != expectedP50 {
		t.Errorf("Expected P50 target %v, got %v", expectedP50, targets.P50)
	}
	if targets.P95 != expectedP95 {
		t.Errorf("Expected P95 target %v, got %v", expectedP95, targets.P95)
	}
}

func TestWANVideoLatencyTargets(t *testing.T) {
	targets := WANVideoLatencyTargets()

	expectedP50 := 400 * time.Millisecond
	expectedP95 := 1000 * time.Millisecond

	if targets.P50 != expectedP50 {
		t.Errorf("Expected WAN P50 target %v, got %v", expectedP50, targets.P50)
	}
	if targets.P95 != expectedP95 {
		t.Errorf("Expected WAN P95 target %v, got %v", expectedP95, targets.P95)
	}
}

func TestVideoLatencyReport_String(t *testing.T) {
	c := NewVideoLatencyCollector(100)

	// Generate some latency samples
	for i := 0; i < 10; i++ {
		latency := time.Duration(100+i*20) * time.Millisecond
		c.RecordLatency(latency)
	}

	report := c.GenerateReport(DefaultVideoLatencyTargets())
	reportStr := report.String()

	// Check for expected content
	expectedParts := []string{
		"Video Latency Report",
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

func TestVideoLatencyReport_StringEmpty(t *testing.T) {
	c := NewVideoLatencyCollector(100)
	report := c.GenerateReport(DefaultVideoLatencyTargets())
	reportStr := report.String()

	// Should handle empty samples gracefully
	if !strings.Contains(reportStr, "Sample Count: 0") {
		t.Errorf("Expected 'Sample Count: 0' in empty report, got:\n%s", reportStr)
	}
}
