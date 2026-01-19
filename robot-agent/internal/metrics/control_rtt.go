package metrics

import (
	"sort"
	"sync"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

const stalePingThreshold = 5 * time.Second

// ControlRTTSample represents a single RTT measurement.
type ControlRTTSample struct {
	Seq      uint32
	SendTime int64
	RecvTime int64
	RTT      time.Duration
}

// ControlRTTCollector collects control RTT measurements.
type ControlRTTCollector struct {
	mu           sync.Mutex
	samples      []ControlRTTSample
	maxSamples   int
	pendingPings map[uint32]int64
	nextSeq      uint32
}

// NewControlRTTCollector creates a new RTT collector.
func NewControlRTTCollector(maxSamples int) *ControlRTTCollector {
	if maxSamples <= 0 {
		maxSamples = 1000
	}
	return &ControlRTTCollector{
		samples:      make([]ControlRTTSample, 0, maxSamples),
		maxSamples:   maxSamples,
		pendingPings: make(map[uint32]int64),
	}
}

// GeneratePing creates a new ping message and tracks it.
func (c *ControlRTTCollector) GeneratePing() *protocol.PingMessage {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Cleanup stale pending pings
	c.cleanupStalePings()

	now := time.Now().UnixNano()
	seq := c.nextSeq
	c.nextSeq++

	c.pendingPings[seq] = now

	return &protocol.PingMessage{
		Type:  protocol.TypePing,
		Seq:   seq,
		TMono: now,
	}
}

// RecordPong processes a pong response and calculates RTT.
func (c *ControlRTTCollector) RecordPong(pong *protocol.PongMessage) {
	c.mu.Lock()
	defer c.mu.Unlock()

	sendTime, exists := c.pendingPings[pong.Seq]
	if !exists {
		return
	}

	delete(c.pendingPings, pong.Seq)

	recvTime := time.Now().UnixNano()
	rtt := time.Duration(recvTime - sendTime)

	sample := ControlRTTSample{
		Seq:      pong.Seq,
		SendTime: sendTime,
		RecvTime: recvTime,
		RTT:      rtt,
	}

	if len(c.samples) >= c.maxSamples {
		c.samples = c.samples[1:]
	}
	c.samples = append(c.samples, sample)
}

// Stats computes percentile statistics from collected samples.
func (c *ControlRTTCollector) Stats() RevocationStats {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.statsLocked()
}

// statsLocked computes stats without acquiring lock (caller must hold lock).
func (c *ControlRTTCollector) statsLocked() RevocationStats {
	if len(c.samples) == 0 {
		return RevocationStats{}
	}

	rtts := make([]time.Duration, len(c.samples))
	for i, s := range c.samples {
		rtts[i] = s.RTT
	}

	sort.Slice(rtts, func(i, j int) bool {
		return rtts[i] < rtts[j]
	})

	var total time.Duration
	for _, rtt := range rtts {
		total += rtt
	}

	return RevocationStats{
		Count: len(rtts),
		Min:   rtts[0],
		Max:   rtts[len(rtts)-1],
		P50:   percentile(rtts, 50),
		P95:   percentile(rtts, 95),
		P99:   percentile(rtts, 99),
		Avg:   total / time.Duration(len(rtts)),
	}
}

// Count returns the number of recorded samples.
func (c *ControlRTTCollector) Count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.samples)
}

// Reset clears all samples and pending pings.
func (c *ControlRTTCollector) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.samples = make([]ControlRTTSample, 0, c.maxSamples)
	c.pendingPings = make(map[uint32]int64)
}

// cleanupStalePings removes pending pings older than threshold.
func (c *ControlRTTCollector) cleanupStalePings() {
	now := time.Now().UnixNano()
	threshold := stalePingThreshold.Nanoseconds()

	for seq, sendTime := range c.pendingPings {
		if now-sendTime > threshold {
			delete(c.pendingPings, seq)
		}
	}
}
