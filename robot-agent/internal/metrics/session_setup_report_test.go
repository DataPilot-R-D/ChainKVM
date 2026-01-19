package metrics

import (
	"strings"
	"testing"
	"time"
)

func TestSessionSetupCollector_GenerateReport(t *testing.T) {
	c := NewSessionSetupCollector(100)

	base := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	durations := []time.Duration{500, 1000, 1500, 2000, 2500}

	for _, d := range durations {
		c.Record(SessionSetupTimestamps{
			SessionID:        "sess",
			OfferReceived:    base,
			DataChannelReady: base.Add(d * time.Millisecond),
		})
	}

	targets := SessionSetupTargets{
		TotalP50: 2 * time.Second,
		TotalP95: 5 * time.Second,
	}

	report := c.GenerateReport(targets)

	if report.SampleCount != len(durations) {
		t.Errorf("SampleCount = %d, want %d", report.SampleCount, len(durations))
	}

	if report.Total.Count != len(durations) {
		t.Errorf("Total.Count = %d, want %d", report.Total.Count, len(durations))
	}

	if report.Total.Min != 500*time.Millisecond {
		t.Errorf("Total.Min = %v, want 500ms", report.Total.Min)
	}

	if report.Total.Max != 2500*time.Millisecond {
		t.Errorf("Total.Max = %v, want 2500ms", report.Total.Max)
	}
}

func TestSessionSetupReport_MeetsTarget(t *testing.T) {
	tests := []struct {
		name       string
		durations  []time.Duration
		targets    SessionSetupTargets
		wantMeets  bool
	}{
		{
			name:      "all within targets",
			durations: []time.Duration{500, 1000, 1500},
			targets: SessionSetupTargets{
				TotalP50: 2 * time.Second,
				TotalP95: 5 * time.Second,
			},
			wantMeets: true,
		},
		{
			name:      "p50 exceeds target",
			durations: []time.Duration{2500, 3000, 3500, 4000, 4500},
			targets: SessionSetupTargets{
				TotalP50: 2 * time.Second,
				TotalP95: 5 * time.Second,
			},
			wantMeets: false,
		},
		{
			name:      "p95 exceeds target",
			durations: []time.Duration{500, 1000, 1500, 2000, 6000},
			targets: SessionSetupTargets{
				TotalP50: 2 * time.Second,
				TotalP95: 5 * time.Second,
			},
			wantMeets: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := NewSessionSetupCollector(100)
			base := time.Now()

			for _, d := range tt.durations {
				c.Record(SessionSetupTimestamps{
					SessionID:        "sess",
					OfferReceived:    base,
					DataChannelReady: base.Add(d * time.Millisecond),
				})
			}

			report := c.GenerateReport(tt.targets)

			if report.MeetsTarget != tt.wantMeets {
				t.Errorf("MeetsTarget = %v, want %v (p50=%v, p95=%v)",
					report.MeetsTarget, tt.wantMeets, report.Total.P50, report.Total.P95)
			}
		})
	}
}

func TestSessionSetupReport_String(t *testing.T) {
	c := NewSessionSetupCollector(100)

	base := time.Now()
	c.Record(SessionSetupTimestamps{
		SessionID:        "sess",
		OfferReceived:    base,
		DataChannelReady: base.Add(500 * time.Millisecond),
	})

	targets := SessionSetupTargets{
		TotalP50: 2 * time.Second,
		TotalP95: 5 * time.Second,
	}

	report := c.GenerateReport(targets)
	output := report.String()

	expectedSubstrings := []string{
		"Session Setup Measurement Report",
		"Samples: 1",
		"PASS",
	}

	for _, substr := range expectedSubstrings {
		if !strings.Contains(output, substr) {
			t.Errorf("report output missing expected substring %q", substr)
		}
	}
}

func TestSessionSetupReport_JSON(t *testing.T) {
	c := NewSessionSetupCollector(100)

	base := time.Now()
	c.Record(SessionSetupTimestamps{
		SessionID:        "sess",
		OfferReceived:    base,
		DataChannelReady: base.Add(500 * time.Millisecond),
	})

	targets := SessionSetupTargets{
		TotalP50: 2 * time.Second,
		TotalP95: 5 * time.Second,
	}

	report := c.GenerateReport(targets)
	jsonBytes, err := report.JSON()

	if err != nil {
		t.Fatalf("JSON() error = %v", err)
	}

	json := string(jsonBytes)
	if !strings.Contains(json, "sample_count") {
		t.Errorf("JSON missing sample_count field")
	}
	if !strings.Contains(json, "meets_target") {
		t.Errorf("JSON missing meets_target field")
	}
}

func TestDefaultSessionSetupTargets(t *testing.T) {
	targets := DefaultSessionSetupTargets()

	if targets.TotalP50 != 2*time.Second {
		t.Errorf("TotalP50 = %v, want 2s", targets.TotalP50)
	}

	if targets.TotalP95 != 5*time.Second {
		t.Errorf("TotalP95 = %v, want 5s", targets.TotalP95)
	}
}
