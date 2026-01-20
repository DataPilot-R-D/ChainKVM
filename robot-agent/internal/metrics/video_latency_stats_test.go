package metrics

import (
	"testing"
	"time"
)

func TestVideoLatencyCollector_Stats(t *testing.T) {
	c := NewVideoLatencyCollector(100)

	// Record multiple samples with known latencies
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

	stats := c.Stats()

	// Check sample count
	if stats.Count != len(latencies) {
		t.Errorf("Expected count %d, got %d", len(latencies), stats.Count)
	}

	// Check min/max
	if stats.Min != 100*time.Millisecond {
		t.Errorf("Expected min 100ms, got %v", stats.Min)
	}
	if stats.Max != 300*time.Millisecond {
		t.Errorf("Expected max 300ms, got %v", stats.Max)
	}

	// Check P50 (median)
	if stats.P50 != 200*time.Millisecond {
		t.Errorf("Expected P50 200ms, got %v", stats.P50)
	}

	// Check percentiles are ordered
	if stats.P50 < stats.Min || stats.P50 > stats.Max {
		t.Errorf("P50 %v out of range [%v, %v]", stats.P50, stats.Min, stats.Max)
	}
	if stats.P95 < stats.P50 || stats.P95 > stats.Max {
		t.Errorf("P95 %v out of range [%v, %v]", stats.P95, stats.P50, stats.Max)
	}
	if stats.P99 < stats.P95 || stats.P99 > stats.Max {
		t.Errorf("P99 %v out of range [%v, %v]", stats.P99, stats.P95, stats.Max)
	}

	// Check average
	var total time.Duration
	for _, lat := range latencies {
		total += lat
	}
	expectedAvg := total / time.Duration(len(latencies))
	if stats.Avg != expectedAvg {
		t.Errorf("Expected avg %v, got %v", expectedAvg, stats.Avg)
	}
}

func TestVideoLatencyCollector_EmptyStats(t *testing.T) {
	c := NewVideoLatencyCollector(100)

	// Stats on empty collector should return empty RevocationStats
	stats := c.Stats()

	if stats.Count != 0 {
		t.Errorf("Expected count 0, got %d", stats.Count)
	}
	if stats.Min != 0 {
		t.Errorf("Expected min 0, got %v", stats.Min)
	}
	if stats.Max != 0 {
		t.Errorf("Expected max 0, got %v", stats.Max)
	}
}
