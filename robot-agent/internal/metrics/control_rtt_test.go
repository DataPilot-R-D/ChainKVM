package metrics

import (
	"sync"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

func TestControlRTTCollector_GeneratePing(t *testing.T) {
	c := NewControlRTTCollector(100)

	ping1 := c.GeneratePing()
	if ping1.Type != protocol.TypePing {
		t.Errorf("Expected type %s, got %s", protocol.TypePing, ping1.Type)
	}
	if ping1.Seq != 0 {
		t.Errorf("Expected seq 0, got %d", ping1.Seq)
	}
	if ping1.TMono == 0 {
		t.Error("Expected non-zero TMono")
	}

	ping2 := c.GeneratePing()
	if ping2.Seq != 1 {
		t.Errorf("Expected seq 1, got %d", ping2.Seq)
	}
	if ping2.TMono <= ping1.TMono {
		t.Error("Expected TMono to increase")
	}
}

func TestControlRTTCollector_RecordPong(t *testing.T) {
	c := NewControlRTTCollector(100)

	// Generate ping to create pending entry
	ping := c.GeneratePing()
	sendTime := ping.TMono

	// Simulate network delay
	time.Sleep(10 * time.Millisecond)

	// Record pong
	pong := &protocol.PongMessage{
		Type:  protocol.TypePong,
		Seq:   ping.Seq,
		TMono: ping.TMono,
		TRecv: time.Now().UnixNano(),
	}
	c.RecordPong(pong)

	// Check that sample was recorded
	if c.Count() != 1 {
		t.Errorf("Expected 1 sample, got %d", c.Count())
	}

	// Check RTT calculation
	stats := c.Stats()
	if stats.Min <= 0 {
		t.Errorf("Expected positive RTT, got %v", stats.Min)
	}
	if stats.Min < 10*time.Millisecond {
		t.Errorf("Expected RTT >= 10ms due to sleep, got %v", stats.Min)
	}

	// Verify pending ping was removed
	c.mu.Lock()
	if _, exists := c.pendingPings[ping.Seq]; exists {
		t.Error("Expected pending ping to be removed after pong")
	}
	c.mu.Unlock()

	// Verify sample has correct SendTime
	c.mu.Lock()
	sample := c.samples[0]
	c.mu.Unlock()
	if sample.SendTime != sendTime {
		t.Errorf("Expected SendTime %d, got %d", sendTime, sample.SendTime)
	}
}

func TestControlRTTCollector_PendingPings(t *testing.T) {
	c := NewControlRTTCollector(100)

	// Generate multiple pings
	ping1 := c.GeneratePing()
	ping2 := c.GeneratePing()
	ping3 := c.GeneratePing()

	// Verify pending pings
	c.mu.Lock()
	if len(c.pendingPings) != 3 {
		t.Errorf("Expected 3 pending pings, got %d", len(c.pendingPings))
	}
	if _, exists := c.pendingPings[ping1.Seq]; !exists {
		t.Error("Expected ping1 in pending")
	}
	if _, exists := c.pendingPings[ping2.Seq]; !exists {
		t.Error("Expected ping2 in pending")
	}
	if _, exists := c.pendingPings[ping3.Seq]; !exists {
		t.Error("Expected ping3 in pending")
	}
	c.mu.Unlock()

	// Record pong for ping2 only
	pong := &protocol.PongMessage{
		Type:  protocol.TypePong,
		Seq:   ping2.Seq,
		TMono: ping2.TMono,
		TRecv: time.Now().UnixNano(),
	}
	c.RecordPong(pong)

	// Verify only ping2 removed from pending
	c.mu.Lock()
	if len(c.pendingPings) != 2 {
		t.Errorf("Expected 2 pending pings after recording pong, got %d", len(c.pendingPings))
	}
	if _, exists := c.pendingPings[ping2.Seq]; exists {
		t.Error("Expected ping2 removed from pending")
	}
	if _, exists := c.pendingPings[ping1.Seq]; !exists {
		t.Error("Expected ping1 still pending")
	}
	if _, exists := c.pendingPings[ping3.Seq]; !exists {
		t.Error("Expected ping3 still pending")
	}
	c.mu.Unlock()
}

func TestControlRTTCollector_UnmatchedPong(t *testing.T) {
	c := NewControlRTTCollector(100)

	// Record pong with no matching ping
	pong := &protocol.PongMessage{
		Type:  protocol.TypePong,
		Seq:   999,
		TMono: time.Now().UnixNano(),
		TRecv: time.Now().UnixNano(),
	}
	c.RecordPong(pong)

	// Should not create a sample
	if c.Count() != 0 {
		t.Errorf("Expected 0 samples for unmatched pong, got %d", c.Count())
	}
}

func TestControlRTTCollector_Stats(t *testing.T) {
	c := NewControlRTTCollector(100)

	// Generate multiple ping-pong pairs with known delays
	delays := []time.Duration{
		10 * time.Millisecond,
		20 * time.Millisecond,
		30 * time.Millisecond,
		40 * time.Millisecond,
		50 * time.Millisecond,
	}

	for _, delay := range delays {
		ping := c.GeneratePing()
		time.Sleep(delay)
		pong := &protocol.PongMessage{
			Type:  protocol.TypePong,
			Seq:   ping.Seq,
			TMono: ping.TMono,
			TRecv: time.Now().UnixNano(),
		}
		c.RecordPong(pong)
	}

	stats := c.Stats()

	// Check sample count
	if stats.Count != len(delays) {
		t.Errorf("Expected count %d, got %d", len(delays), stats.Count)
	}

	// Check min/max bounds
	if stats.Min < 10*time.Millisecond {
		t.Errorf("Expected min >= 10ms, got %v", stats.Min)
	}
	if stats.Max < 50*time.Millisecond {
		t.Errorf("Expected max >= 50ms, got %v", stats.Max)
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
}

func TestControlRTTCollector_RingBuffer(t *testing.T) {
	maxSamples := 5
	c := NewControlRTTCollector(maxSamples)

	// Record more samples than max
	for i := 0; i < maxSamples+3; i++ {
		ping := c.GeneratePing()
		pong := &protocol.PongMessage{
			Type:  protocol.TypePong,
			Seq:   ping.Seq,
			TMono: ping.TMono,
			TRecv: time.Now().UnixNano(),
		}
		c.RecordPong(pong)
	}

	// Should only keep maxSamples
	if c.Count() != maxSamples {
		t.Errorf("Expected %d samples (ring buffer), got %d", maxSamples, c.Count())
	}

	// Oldest samples should be evicted (seq 0, 1, 2)
	c.mu.Lock()
	firstSeq := c.samples[0].Seq
	c.mu.Unlock()

	if firstSeq != 3 {
		t.Errorf("Expected oldest sample seq 3 (0,1,2 evicted), got %d", firstSeq)
	}
}

func TestControlRTTCollector_ConcurrentAccess(t *testing.T) {
	c := NewControlRTTCollector(1000)

	var wg sync.WaitGroup
	const numWriters = 10
	const numReaders = 5
	const iterations = 100

	// Concurrent writers (GeneratePing + RecordPong)
	for i := 0; i < numWriters; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				ping := c.GeneratePing()
				pong := &protocol.PongMessage{
					Type:  protocol.TypePong,
					Seq:   ping.Seq,
					TMono: ping.TMono,
					TRecv: time.Now().UnixNano(),
				}
				c.RecordPong(pong)
			}
		}()
	}

	// Concurrent readers (Stats, Count)
	for i := 0; i < numReaders; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				_ = c.Stats()
				_ = c.Count()
			}
		}()
	}

	wg.Wait()

	// No race condition should occur
	// Final count should be writers * iterations
	expectedCount := numWriters * iterations
	actualCount := c.Count()
	if actualCount > expectedCount {
		t.Errorf("Expected at most %d samples, got %d", expectedCount, actualCount)
	}
}

func TestControlRTTCollector_Reset(t *testing.T) {
	c := NewControlRTTCollector(100)

	// Generate some data
	for i := 0; i < 10; i++ {
		ping := c.GeneratePing()
		pong := &protocol.PongMessage{
			Type:  protocol.TypePong,
			Seq:   ping.Seq,
			TMono: ping.TMono,
			TRecv: time.Now().UnixNano(),
		}
		c.RecordPong(pong)
	}

	if c.Count() != 10 {
		t.Errorf("Expected 10 samples before reset, got %d", c.Count())
	}

	// Reset
	c.Reset()

	// Should clear samples but keep capacity
	if c.Count() != 0 {
		t.Errorf("Expected 0 samples after reset, got %d", c.Count())
	}

	// Verify pending pings also cleared
	c.mu.Lock()
	if len(c.pendingPings) != 0 {
		t.Errorf("Expected 0 pending pings after reset, got %d", len(c.pendingPings))
	}
	c.mu.Unlock()

	// nextSeq should NOT reset (continues counting)
	ping := c.GeneratePing()
	if ping.Seq < 10 {
		t.Errorf("Expected seq >= 10 after reset (continuing sequence), got %d", ping.Seq)
	}
}

func TestNewControlRTTCollector_ZeroMaxSamples(t *testing.T) {
	c := NewControlRTTCollector(0)

	// Should default to 1000
	c.mu.Lock()
	maxSamples := c.maxSamples
	c.mu.Unlock()

	if maxSamples != 1000 {
		t.Errorf("Expected default maxSamples 1000, got %d", maxSamples)
	}
}

func TestControlRTTCollector_StalePingCleanup(t *testing.T) {
	c := NewControlRTTCollector(100)

	// Generate ping
	ping := c.GeneratePing()

	// Manually set SendTime to 10 seconds ago
	c.mu.Lock()
	c.pendingPings[ping.Seq] = time.Now().UnixNano() - (10 * time.Second).Nanoseconds()
	c.mu.Unlock()

	// Generate new ping (should trigger cleanup)
	c.GeneratePing()

	// Stale ping should be removed
	c.mu.Lock()
	if _, exists := c.pendingPings[ping.Seq]; exists {
		t.Error("Expected stale ping to be cleaned up")
	}
	c.mu.Unlock()
}
