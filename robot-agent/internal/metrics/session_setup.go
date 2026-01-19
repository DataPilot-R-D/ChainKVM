package metrics

import (
	"sort"
	"sync"
	"time"
)

// SessionSetupTimestamps captures timing data for session establishment.
type SessionSetupTimestamps struct {
	SessionID string

	// Signaling phase
	OfferReceived  time.Time
	TokenValidated time.Time

	// WebRTC setup
	PeerConnectionCreated time.Time
	AnswerSent            time.Time

	// Connection establishment
	IceComplete           time.Time
	ConnectionEstablished time.Time

	// Session activation
	SessionActivated time.Time
	DataChannelReady time.Time
}

// SessionSetupPhases contains duration breakdowns for session setup.
type SessionSetupPhases struct {
	Total             time.Duration
	TokenValidation   time.Duration
	WebRTCSetup       time.Duration
	IceNegotiation    time.Duration
	SessionActivation time.Duration
}

// Calculate computes phase durations from timestamps.
func (ts *SessionSetupTimestamps) Calculate() SessionSetupPhases {
	return SessionSetupPhases{
		Total:             duration(ts.OfferReceived, ts.DataChannelReady),
		TokenValidation:   duration(ts.OfferReceived, ts.TokenValidated),
		WebRTCSetup:       duration(ts.TokenValidated, ts.AnswerSent),
		IceNegotiation:    duration(ts.AnswerSent, ts.ConnectionEstablished),
		SessionActivation: duration(ts.ConnectionEstablished, ts.DataChannelReady),
	}
}

// SessionSetupCollector collects session setup timing data.
type SessionSetupCollector struct {
	mu         sync.Mutex
	samples    []SessionSetupTimestamps
	maxSamples int
}

// NewSessionSetupCollector creates a new collector with specified max samples.
func NewSessionSetupCollector(maxSamples int) *SessionSetupCollector {
	if maxSamples <= 0 {
		maxSamples = 1000
	}
	return &SessionSetupCollector{
		samples:    make([]SessionSetupTimestamps, 0, maxSamples),
		maxSamples: maxSamples,
	}
}

// Record adds a new measurement to the collector.
func (c *SessionSetupCollector) Record(ts SessionSetupTimestamps) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if len(c.samples) >= c.maxSamples {
		c.samples = c.samples[1:]
	}
	c.samples = append(c.samples, ts)
}

// Count returns the number of recorded measurements.
func (c *SessionSetupCollector) Count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.samples)
}

// Reset clears all recorded measurements.
func (c *SessionSetupCollector) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.samples = c.samples[:0]
}

// Stats calculates statistics for total setup time.
func (c *SessionSetupCollector) Stats() RevocationStats {
	c.mu.Lock()
	defer c.mu.Unlock()

	return calculateSessionSetupStats(c.samples, func(ts SessionSetupTimestamps) time.Duration {
		return ts.Calculate().Total
	})
}

// calculateSessionSetupStats computes statistics using extractor function.
func calculateSessionSetupStats(samples []SessionSetupTimestamps, extract func(SessionSetupTimestamps) time.Duration) RevocationStats {
	if len(samples) == 0 {
		return RevocationStats{}
	}

	durations := make([]time.Duration, 0, len(samples))
	for _, s := range samples {
		d := extract(s)
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
