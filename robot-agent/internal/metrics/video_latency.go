package metrics

import (
	"sort"
	"sync"
	"time"
)

// VideoLatencySample represents a single video latency measurement.
type VideoLatencySample struct {
	FrameTimestamp time.Time     // When frame was captured/overlayed
	Extracted      time.Time     // When timestamp was extracted from decoded frame
	Latency        time.Duration // End-to-end latency
}

// VideoLatencyCollector collects video latency measurements.
type VideoLatencyCollector struct {
	mu         sync.Mutex
	samples    []VideoLatencySample
	maxSamples int
}

// NewVideoLatencyCollector creates a new video latency collector.
func NewVideoLatencyCollector(maxSamples int) *VideoLatencyCollector {
	if maxSamples <= 0 {
		maxSamples = 1000
	}
	return &VideoLatencyCollector{
		samples:    make([]VideoLatencySample, 0, maxSamples),
		maxSamples: maxSamples,
	}
}

// Record adds a new latency measurement to the collector.
func (c *VideoLatencyCollector) Record(frameTimestamp time.Time, extractedAt time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()

	latency := extractedAt.Sub(frameTimestamp)

	sample := VideoLatencySample{
		FrameTimestamp: frameTimestamp,
		Extracted:      extractedAt,
		Latency:        latency,
	}

	// Ring buffer: remove oldest if at capacity
	if len(c.samples) >= c.maxSamples {
		c.samples = c.samples[1:]
	}
	c.samples = append(c.samples, sample)
}

// RecordLatency directly records a latency value.
func (c *VideoLatencyCollector) RecordLatency(latency time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	sample := VideoLatencySample{
		FrameTimestamp: time.Time{},
		Extracted:      time.Now(),
		Latency:        latency,
	}

	if len(c.samples) >= c.maxSamples {
		c.samples = c.samples[1:]
	}
	c.samples = append(c.samples, sample)
}

// Stats computes percentile statistics from collected samples.
func (c *VideoLatencyCollector) Stats() RevocationStats {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.statsLocked()
}

// statsLocked computes stats without acquiring lock (caller must hold lock).
func (c *VideoLatencyCollector) statsLocked() RevocationStats {
	if len(c.samples) == 0 {
		return RevocationStats{}
	}

	latencies := make([]time.Duration, len(c.samples))
	for i, s := range c.samples {
		latencies[i] = s.Latency
	}

	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	var total time.Duration
	for _, lat := range latencies {
		total += lat
	}

	return RevocationStats{
		Count: len(latencies),
		Min:   latencies[0],
		Max:   latencies[len(latencies)-1],
		P50:   percentile(latencies, 50),
		P95:   percentile(latencies, 95),
		P99:   percentile(latencies, 99),
		Avg:   total / time.Duration(len(latencies)),
	}
}

// Count returns the number of recorded samples.
func (c *VideoLatencyCollector) Count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.samples)
}

// Reset clears all samples.
func (c *VideoLatencyCollector) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.samples = make([]VideoLatencySample, 0, c.maxSamples)
}

// GetSamples returns a copy of all collected samples.
func (c *VideoLatencyCollector) GetSamples() []VideoLatencySample {
	c.mu.Lock()
	defer c.mu.Unlock()

	result := make([]VideoLatencySample, len(c.samples))
	copy(result, c.samples)
	return result
}
