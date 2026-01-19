package metrics

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestGenerateReport(t *testing.T) {
	c := NewRevocationCollector(100)

	base := time.Now()
	for i := range 10 {
		c.Record(RevocationTimestamps{
			SessionID:         "session",
			MessageReceived:   base,
			HandlerStarted:    base.Add(1 * time.Millisecond),
			TransportClosed:   base.Add(5 * time.Millisecond),
			SessionTerminated: base.Add(8 * time.Millisecond),
			SafeStopTriggered: base.Add(10 * time.Millisecond),
			SafeStopCompleted: base.Add(time.Duration(15+i) * time.Millisecond),
		})
	}

	report := c.GenerateReport(DefaultTargets())

	if report.SampleCount != 10 {
		t.Errorf("SampleCount: expected 10, got %d", report.SampleCount)
	}

	if report.Total.Count != 10 {
		t.Errorf("Total.Count: expected 10, got %d", report.Total.Count)
	}

	if report.Total.Min < 15*time.Millisecond || report.Total.Min > 16*time.Millisecond {
		t.Errorf("Total.Min: expected ~15ms, got %v", report.Total.Min)
	}
}

func TestGenerateReport_MeetsTarget(t *testing.T) {
	c := NewRevocationCollector(100)

	base := time.Now()
	// All measurements under targets
	for range 10 {
		c.Record(RevocationTimestamps{
			MessageReceived:   base,
			SafeStopTriggered: base.Add(50 * time.Millisecond),
			SafeStopCompleted: base.Add(80 * time.Millisecond), // < 100ms
		})
	}

	targets := LatencyTargets{
		TotalP95:    1 * time.Second,
		SafeStopMax: 100 * time.Millisecond,
	}

	report := c.GenerateReport(targets)

	if !report.MeetsTarget {
		t.Error("expected MeetsTarget to be true")
	}
}

func TestGenerateReport_FailsTarget(t *testing.T) {
	c := NewRevocationCollector(100)

	base := time.Now()
	// Safe-stop exceeds 100ms target
	c.Record(RevocationTimestamps{
		MessageReceived:   base,
		SafeStopTriggered: base,
		SafeStopCompleted: base.Add(150 * time.Millisecond), // > 100ms
	})

	targets := LatencyTargets{
		TotalP95:    1 * time.Second,
		SafeStopMax: 100 * time.Millisecond,
	}

	report := c.GenerateReport(targets)

	if report.MeetsTarget {
		t.Error("expected MeetsTarget to be false (safe-stop > 100ms)")
	}
}

func TestReport_JSON(t *testing.T) {
	c := NewRevocationCollector(100)

	base := time.Now()
	c.Record(RevocationTimestamps{
		MessageReceived:   base,
		SafeStopCompleted: base.Add(50 * time.Millisecond),
	})

	report := c.GenerateReport(DefaultTargets())

	jsonData, err := report.JSON()
	if err != nil {
		t.Fatalf("JSON() error: %v", err)
	}

	// Verify it's valid JSON
	var parsed map[string]any
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	if _, ok := parsed["sample_count"]; !ok {
		t.Error("JSON missing sample_count field")
	}

	if _, ok := parsed["meets_target"]; !ok {
		t.Error("JSON missing meets_target field")
	}
}

func TestReport_String(t *testing.T) {
	c := NewRevocationCollector(100)

	base := time.Now()
	c.Record(RevocationTimestamps{
		MessageReceived:   base,
		HandlerStarted:    base.Add(1 * time.Millisecond),
		SafeStopTriggered: base.Add(10 * time.Millisecond),
		SafeStopCompleted: base.Add(50 * time.Millisecond),
	})

	report := c.GenerateReport(DefaultTargets())
	output := report.String()

	if !strings.Contains(output, "Revocation Propagation Measurement Report") {
		t.Error("String() missing header")
	}

	if !strings.Contains(output, "Samples: 1") {
		t.Error("String() missing sample count")
	}

	if !strings.Contains(output, "Total Propagation Time:") {
		t.Error("String() missing total section")
	}

	if !strings.Contains(output, "Safe-Stop Execution Time:") {
		t.Error("String() missing safe-stop section")
	}

	// Should pass targets
	if !strings.Contains(output, "PASS") {
		t.Error("String() missing PASS indicator")
	}
}

func TestReport_StringEmpty(t *testing.T) {
	c := NewRevocationCollector(100)

	report := c.GenerateReport(DefaultTargets())
	output := report.String()

	if !strings.Contains(output, "Samples: 0") {
		t.Error("String() should show 0 samples for empty collector")
	}

	if !strings.Contains(output, "No data") {
		t.Error("String() should show 'No data' for empty stats")
	}
}

func TestDefaultTargets(t *testing.T) {
	targets := DefaultTargets()

	if targets.TotalP95 != 1*time.Second {
		t.Errorf("TotalP95: expected 1s, got %v", targets.TotalP95)
	}

	if targets.SafeStopMax != 100*time.Millisecond {
		t.Errorf("SafeStopMax: expected 100ms, got %v", targets.SafeStopMax)
	}
}
