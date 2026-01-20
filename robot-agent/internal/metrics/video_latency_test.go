package metrics

import (
	"testing"
	"time"
)

func TestVideoLatencyCollector_RecordLatency(t *testing.T) {
	c := NewVideoLatencyCollector(100)

	// Record a latency measurement
	latency := 100 * time.Millisecond
	c.RecordLatency(latency)

	// Check that sample was recorded
	if c.Count() != 1 {
		t.Errorf("Expected 1 sample, got %d", c.Count())
	}

	// Check stats
	stats := c.Stats()
	if stats.Min != latency {
		t.Errorf("Expected min %v, got %v", latency, stats.Min)
	}
	if stats.Max != latency {
		t.Errorf("Expected max %v, got %v", latency, stats.Max)
	}
	if stats.P50 != latency {
		t.Errorf("Expected P50 %v, got %v", latency, stats.P50)
	}
}

func TestVideoLatencyCollector_Record(t *testing.T) {
	c := NewVideoLatencyCollector(100)

	// Record with timestamps
	frameTime := time.Now().Add(-150 * time.Millisecond)
	extractTime := time.Now()
	c.Record(frameTime, extractTime)

	// Check that sample was recorded
	if c.Count() != 1 {
		t.Errorf("Expected 1 sample, got %d", c.Count())
	}

	// Check latency calculation
	stats := c.Stats()
	expectedLatency := extractTime.Sub(frameTime)
	tolerance := 10 * time.Millisecond

	if stats.Min < expectedLatency-tolerance || stats.Min > expectedLatency+tolerance {
		t.Errorf("Expected min ~%v, got %v", expectedLatency, stats.Min)
	}
}
