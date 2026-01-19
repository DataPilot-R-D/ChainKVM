package metrics

import (
	"testing"
	"time"
)

func TestRevocationTimestamps_Calculate(t *testing.T) {
	base := time.Now()

	ts := RevocationTimestamps{
		SessionID:          "test-session",
		MessageReceived:    base,
		HandlerStarted:     base.Add(1 * time.Millisecond),
		TransportClosed:    base.Add(5 * time.Millisecond),
		SessionTerminated:  base.Add(8 * time.Millisecond),
		SafeStopTriggered:  base.Add(10 * time.Millisecond),
		SafeStopCompleted:  base.Add(15 * time.Millisecond),
		HardwareStopIssued: base.Add(12 * time.Millisecond),
	}

	p := ts.Calculate()

	if p.Total != 15*time.Millisecond {
		t.Errorf("Total: expected 15ms, got %v", p.Total)
	}

	if p.HandlerProcessing != 9*time.Millisecond {
		t.Errorf("HandlerProcessing: expected 9ms, got %v", p.HandlerProcessing)
	}

	if p.TransportTeardown != 4*time.Millisecond {
		t.Errorf("TransportTeardown: expected 4ms, got %v", p.TransportTeardown)
	}

	if p.SessionTeardown != 3*time.Millisecond {
		t.Errorf("SessionTeardown: expected 3ms, got %v", p.SessionTeardown)
	}

	if p.SafeStopExecution != 5*time.Millisecond {
		t.Errorf("SafeStopExecution: expected 5ms, got %v", p.SafeStopExecution)
	}
}

func TestRevocationTimestamps_Calculate_Partial(t *testing.T) {
	base := time.Now()

	ts := RevocationTimestamps{
		MessageReceived:   base,
		SafeStopCompleted: base.Add(50 * time.Millisecond),
	}

	p := ts.Calculate()

	if p.Total != 50*time.Millisecond {
		t.Errorf("Total: expected 50ms, got %v", p.Total)
	}

	// Other fields should be zero
	if p.HandlerProcessing != 0 {
		t.Errorf("HandlerProcessing should be zero, got %v", p.HandlerProcessing)
	}
}

func TestRevocationCollector_Record(t *testing.T) {
	c := NewRevocationCollector(100)

	if c.Count() != 0 {
		t.Errorf("expected 0 measurements, got %d", c.Count())
	}

	base := time.Now()
	c.Record(RevocationTimestamps{
		SessionID:         "s1",
		MessageReceived:   base,
		SafeStopCompleted: base.Add(20 * time.Millisecond),
	})

	if c.Count() != 1 {
		t.Errorf("expected 1 measurement, got %d", c.Count())
	}
}

func TestRevocationCollector_RingBuffer(t *testing.T) {
	c := NewRevocationCollector(3)

	base := time.Now()
	for i := range 5 {
		c.Record(RevocationTimestamps{
			SessionID:         "session",
			MessageReceived:   base,
			SafeStopCompleted: base.Add(time.Duration(i+1) * 10 * time.Millisecond),
		})
	}

	// Should only keep last 3
	if c.Count() != 3 {
		t.Errorf("expected 3 measurements (ring buffer), got %d", c.Count())
	}
}

func TestRevocationCollector_Stats(t *testing.T) {
	c := NewRevocationCollector(100)

	base := time.Now()
	durations := []time.Duration{10, 20, 30, 40, 50, 60, 70, 80, 90, 100}

	for i, d := range durations {
		c.Record(RevocationTimestamps{
			SessionID:         "session",
			MessageReceived:   base,
			SafeStopCompleted: base.Add(d * time.Millisecond),
		})
		_ = i
	}

	stats := c.Stats()

	if stats.Count != 10 {
		t.Errorf("Count: expected 10, got %d", stats.Count)
	}

	if stats.Min != 10*time.Millisecond {
		t.Errorf("Min: expected 10ms, got %v", stats.Min)
	}

	if stats.Max != 100*time.Millisecond {
		t.Errorf("Max: expected 100ms, got %v", stats.Max)
	}

	// P50 should be around 50ms (5th element in sorted list of 10)
	if stats.P50 < 40*time.Millisecond || stats.P50 > 60*time.Millisecond {
		t.Errorf("P50: expected ~50ms, got %v", stats.P50)
	}

	// P95 should be around 95ms
	if stats.P95 < 90*time.Millisecond || stats.P95 > 100*time.Millisecond {
		t.Errorf("P95: expected ~95ms, got %v", stats.P95)
	}

	// Average should be 55ms
	if stats.Avg != 55*time.Millisecond {
		t.Errorf("Avg: expected 55ms, got %v", stats.Avg)
	}
}

func TestRevocationCollector_StatsEmpty(t *testing.T) {
	c := NewRevocationCollector(100)

	stats := c.Stats()

	if stats.Count != 0 {
		t.Errorf("Count: expected 0, got %d", stats.Count)
	}

	if stats.P50 != 0 {
		t.Errorf("P50: expected 0, got %v", stats.P50)
	}
}

func TestRevocationCollector_Reset(t *testing.T) {
	c := NewRevocationCollector(100)

	base := time.Now()
	c.Record(RevocationTimestamps{
		MessageReceived:   base,
		SafeStopCompleted: base.Add(10 * time.Millisecond),
	})

	if c.Count() != 1 {
		t.Fatalf("expected 1 measurement before reset")
	}

	c.Reset()

	if c.Count() != 0 {
		t.Errorf("expected 0 measurements after reset, got %d", c.Count())
	}
}

func TestRevocationCollector_SafeStopStats(t *testing.T) {
	c := NewRevocationCollector(100)

	base := time.Now()
	c.Record(RevocationTimestamps{
		SafeStopTriggered: base,
		SafeStopCompleted: base.Add(5 * time.Millisecond),
	})
	c.Record(RevocationTimestamps{
		SafeStopTriggered: base,
		SafeStopCompleted: base.Add(10 * time.Millisecond),
	})

	stats := c.SafeStopStats()

	if stats.Count != 2 {
		t.Errorf("Count: expected 2, got %d", stats.Count)
	}

	if stats.Min != 5*time.Millisecond {
		t.Errorf("Min: expected 5ms, got %v", stats.Min)
	}

	if stats.Max != 10*time.Millisecond {
		t.Errorf("Max: expected 10ms, got %v", stats.Max)
	}
}

func TestPercentile_EdgeCases(t *testing.T) {
	// Empty slice
	if p := percentile(nil, 50); p != 0 {
		t.Errorf("expected 0 for empty slice, got %v", p)
	}

	// Single element
	single := []time.Duration{100 * time.Millisecond}
	if p := percentile(single, 50); p != 100*time.Millisecond {
		t.Errorf("expected 100ms for single element, got %v", p)
	}

	// P100 should return max
	sorted := []time.Duration{10, 20, 30, 40, 50}
	if p := percentile(sorted, 100); p != 50 {
		t.Errorf("P100: expected 50, got %v", p)
	}
}

func TestNewRevocationCollector_DefaultMaxSamples(t *testing.T) {
	c := NewRevocationCollector(0)

	if c.maxSamples != 1000 {
		t.Errorf("expected default 1000 max samples, got %d", c.maxSamples)
	}
}
