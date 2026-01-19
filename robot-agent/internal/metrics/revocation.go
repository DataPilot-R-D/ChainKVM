// Package metrics provides measurement and statistics for system performance.
package metrics

import (
	"sort"
	"sync"
	"time"
)

// RevocationTimestamps captures timing data for a single revocation event.
type RevocationTimestamps struct {
	SessionID string

	// MessageReceived is when the revocation message was received from gateway.
	MessageReceived time.Time

	// HandlerStarted is when OnRevoked handler began processing.
	HandlerStarted time.Time

	// TransportClosed is when WebRTC transport was closed.
	TransportClosed time.Time

	// SessionTerminated is when session state changed to terminated.
	SessionTerminated time.Time

	// SafeStopTriggered is when safety.OnRevoked() was called.
	SafeStopTriggered time.Time

	// SafeStopCompleted is when safe-stop transition finished.
	SafeStopCompleted time.Time

	// HardwareStopIssued is when hardware E-Stop was executed.
	HardwareStopIssued time.Time
}

// PropagationTimes calculates durations between key events.
type PropagationTimes struct {
	// Total is from message received to safe-stop completed.
	Total time.Duration

	// HandlerProcessing is from handler start to safe-stop triggered.
	HandlerProcessing time.Duration

	// TransportTeardown is time to close transport.
	TransportTeardown time.Duration

	// SessionTeardown is time to terminate session.
	SessionTeardown time.Duration

	// SafeStopExecution is time for safe-stop transition.
	SafeStopExecution time.Duration
}

// Calculate computes propagation times from timestamps.
func (t *RevocationTimestamps) Calculate() PropagationTimes {
	return PropagationTimes{
		Total:             duration(t.MessageReceived, t.SafeStopCompleted),
		HandlerProcessing: duration(t.HandlerStarted, t.SafeStopTriggered),
		TransportTeardown: duration(t.HandlerStarted, t.TransportClosed),
		SessionTeardown:   duration(t.TransportClosed, t.SessionTerminated),
		SafeStopExecution: duration(t.SafeStopTriggered, t.SafeStopCompleted),
	}
}

// duration returns the time between start and end, or zero if either is unset.
func duration(start, end time.Time) time.Duration {
	if start.IsZero() || end.IsZero() {
		return 0
	}
	return end.Sub(start)
}

// RevocationStats holds statistical analysis of revocation measurements.
type RevocationStats struct {
	Count int
	P50   time.Duration
	P95   time.Duration
	P99   time.Duration
	Min   time.Duration
	Max   time.Duration
	Avg   time.Duration
}

// RevocationCollector collects and analyzes revocation timing data.
type RevocationCollector struct {
	mu           sync.Mutex
	measurements []RevocationTimestamps
	maxSamples   int
}

// NewRevocationCollector creates a new collector with specified max samples.
func NewRevocationCollector(maxSamples int) *RevocationCollector {
	if maxSamples <= 0 {
		maxSamples = 1000
	}
	return &RevocationCollector{
		measurements: make([]RevocationTimestamps, 0, maxSamples),
		maxSamples:   maxSamples,
	}
}

// Record adds a new measurement to the collector.
func (c *RevocationCollector) Record(ts RevocationTimestamps) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if len(c.measurements) >= c.maxSamples {
		// Remove oldest (ring buffer behavior)
		c.measurements = c.measurements[1:]
	}
	c.measurements = append(c.measurements, ts)
}

// Stats calculates statistics for total propagation time.
func (c *RevocationCollector) Stats() RevocationStats {
	c.mu.Lock()
	defer c.mu.Unlock()

	return calculateStats(c.measurements, func(t RevocationTimestamps) time.Duration {
		return t.Calculate().Total
	})
}

// SafeStopStats calculates statistics for safe-stop execution time.
func (c *RevocationCollector) SafeStopStats() RevocationStats {
	c.mu.Lock()
	defer c.mu.Unlock()

	return calculateStats(c.measurements, func(t RevocationTimestamps) time.Duration {
		return t.Calculate().SafeStopExecution
	})
}

// Count returns the number of recorded measurements.
func (c *RevocationCollector) Count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.measurements)
}

// Reset clears all recorded measurements.
func (c *RevocationCollector) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.measurements = c.measurements[:0]
}

// calculateStats computes statistics from measurements using extractor function.
func calculateStats(measurements []RevocationTimestamps, extract func(RevocationTimestamps) time.Duration) RevocationStats {
	if len(measurements) == 0 {
		return RevocationStats{}
	}

	durations := make([]time.Duration, 0, len(measurements))
	for _, m := range measurements {
		d := extract(m)
		if d > 0 {
			durations = append(durations, d)
		}
	}

	if len(durations) == 0 {
		return RevocationStats{}
	}

	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})

	var total time.Duration
	for _, d := range durations {
		total += d
	}

	return RevocationStats{
		Count: len(durations),
		P50:   percentile(durations, 50),
		P95:   percentile(durations, 95),
		P99:   percentile(durations, 99),
		Min:   durations[0],
		Max:   durations[len(durations)-1],
		Avg:   total / time.Duration(len(durations)),
	}
}

// percentile calculates the p-th percentile of sorted durations.
func percentile(sorted []time.Duration, p int) time.Duration {
	if len(sorted) == 0 {
		return 0
	}
	idx := (p * len(sorted)) / 100
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}
