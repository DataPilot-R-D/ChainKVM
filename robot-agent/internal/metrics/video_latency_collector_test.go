package metrics

import (
	"sync"
	"testing"
	"time"
)

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
