package metrics

import (
	"sync"
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

func TestVideoLatencyCollector_RingBuffer(t *testing.T) {
	maxSamples := 5
	c := NewVideoLatencyCollector(maxSamples)

	// Record more samples than max
	for i := 0; i < maxSamples+3; i++ {
		c.RecordLatency(time.Duration(i+1) * 10 * time.Millisecond)
	}

	// Should only keep maxSamples
	if c.Count() != maxSamples {
		t.Errorf("Expected %d samples (ring buffer), got %d", maxSamples, c.Count())
	}

	// Oldest samples should be evicted (latencies 10ms, 20ms, 30ms)
	samples := c.GetSamples()
	if len(samples) != maxSamples {
		t.Fatalf("Expected %d samples, got %d", maxSamples, len(samples))
	}

	// First sample should be 40ms (4th recorded)
	expectedFirst := 40 * time.Millisecond
	if samples[0].Latency != expectedFirst {
		t.Errorf("Expected first sample %v (oldest evicted), got %v", expectedFirst, samples[0].Latency)
	}

	// Last sample should be 80ms (8th recorded)
	expectedLast := 80 * time.Millisecond
	if samples[maxSamples-1].Latency != expectedLast {
		t.Errorf("Expected last sample %v, got %v", expectedLast, samples[maxSamples-1].Latency)
	}
}

func TestVideoLatencyCollector_ConcurrentAccess(t *testing.T) {
	c := NewVideoLatencyCollector(1000)

	var wg sync.WaitGroup
	const numWriters = 10
	const numReaders = 5
	const iterations = 100

	// Concurrent writers
	for i := 0; i < numWriters; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				latency := time.Duration(id*100+j) * time.Microsecond
				c.RecordLatency(latency)
			}
		}(i)
	}

	// Concurrent readers
	for i := 0; i < numReaders; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				_ = c.Stats()
				_ = c.Count()
				_ = c.GetSamples()
			}
		}()
	}

	wg.Wait()

	// No race condition should occur
	expectedCount := numWriters * iterations
	actualCount := c.Count()
	if actualCount > expectedCount {
		t.Errorf("Expected at most %d samples, got %d", expectedCount, actualCount)
	}
}

func TestVideoLatencyCollector_Reset(t *testing.T) {
	c := NewVideoLatencyCollector(100)

	// Record some data
	for i := 0; i < 10; i++ {
		c.RecordLatency(time.Duration(i+1) * 10 * time.Millisecond)
	}

	if c.Count() != 10 {
		t.Errorf("Expected 10 samples before reset, got %d", c.Count())
	}

	// Reset
	c.Reset()

	// Should clear samples
	if c.Count() != 0 {
		t.Errorf("Expected 0 samples after reset, got %d", c.Count())
	}

	// Stats should return empty
	stats := c.Stats()
	if stats.Count != 0 {
		t.Errorf("Expected stats count 0 after reset, got %d", stats.Count)
	}

	// Should be able to record new samples
	c.RecordLatency(50 * time.Millisecond)
	if c.Count() != 1 {
		t.Errorf("Expected 1 sample after reset and new record, got %d", c.Count())
	}
}

func TestNewVideoLatencyCollector_ZeroMaxSamples(t *testing.T) {
	c := NewVideoLatencyCollector(0)

	// Should default to 1000
	c.mu.Lock()
	maxSamples := c.maxSamples
	c.mu.Unlock()

	if maxSamples != 1000 {
		t.Errorf("Expected default maxSamples 1000, got %d", maxSamples)
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

func TestVideoLatencyCollector_GetSamples(t *testing.T) {
	c := NewVideoLatencyCollector(100)

	// Record some samples
	latencies := []time.Duration{
		100 * time.Millisecond,
		200 * time.Millisecond,
		300 * time.Millisecond,
	}

	for _, lat := range latencies {
		c.RecordLatency(lat)
	}

	// Get samples
	samples := c.GetSamples()

	if len(samples) != len(latencies) {
		t.Errorf("Expected %d samples, got %d", len(latencies), len(samples))
	}

	// Verify latencies
	for i, expected := range latencies {
		if samples[i].Latency != expected {
			t.Errorf("Sample %d: expected latency %v, got %v", i, expected, samples[i].Latency)
		}
	}

	// Verify it's a copy (modifying returned slice shouldn't affect collector)
	samples[0].Latency = 999 * time.Second
	newSamples := c.GetSamples()
	if newSamples[0].Latency == 999*time.Second {
		t.Error("GetSamples should return a copy, not original slice")
	}
}
