package metrics

import (
	"sync"
	"testing"
	"time"
)

func TestSessionSetupCollector_ConcurrentAccess(t *testing.T) {
	c := NewSessionSetupCollector(100)
	var wg sync.WaitGroup

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			base := time.Now()
			for j := 0; j < 10; j++ {
				c.Record(SessionSetupTimestamps{
					SessionID:        "sess",
					OfferReceived:    base,
					DataChannelReady: base.Add(100 * time.Millisecond),
				})
			}
		}()
	}

	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				_ = c.Stats()
				_ = c.Count()
			}
		}()
	}

	wg.Wait()
}

func TestNewSessionSetupCollector_ZeroMaxSamples(t *testing.T) {
	c := NewSessionSetupCollector(0)

	base := time.Now()
	for i := 0; i < 1001; i++ {
		c.Record(SessionSetupTimestamps{
			SessionID:        "sess",
			OfferReceived:    base,
			DataChannelReady: base.Add(100 * time.Millisecond),
		})
	}

	if c.Count() != 1000 {
		t.Errorf("expected default max of 1000, got %d", c.Count())
	}
}
