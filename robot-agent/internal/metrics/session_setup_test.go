package metrics

import (
	"testing"
	"time"
)

func TestSessionSetupTimestamps_Calculate(t *testing.T) {
	base := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name       string
		timestamps SessionSetupTimestamps
		want       SessionSetupPhases
	}{
		{
			name: "all phases present",
			timestamps: SessionSetupTimestamps{
				SessionID:             "sess-1",
				OfferReceived:         base,
				TokenValidated:        base.Add(100 * time.Millisecond),
				PeerConnectionCreated: base.Add(150 * time.Millisecond),
				AnswerSent:            base.Add(200 * time.Millisecond),
				IceComplete:           base.Add(500 * time.Millisecond),
				ConnectionEstablished: base.Add(600 * time.Millisecond),
				SessionActivated:      base.Add(700 * time.Millisecond),
				DataChannelReady:      base.Add(800 * time.Millisecond),
			},
			want: SessionSetupPhases{
				Total:             800 * time.Millisecond,
				TokenValidation:   100 * time.Millisecond,
				WebRTCSetup:       100 * time.Millisecond,
				IceNegotiation:    400 * time.Millisecond,
				SessionActivation: 200 * time.Millisecond,
			},
		},
		{
			name: "missing intermediate timestamps",
			timestamps: SessionSetupTimestamps{
				SessionID:        "sess-2",
				OfferReceived:    base,
				DataChannelReady: base.Add(1 * time.Second),
			},
			want: SessionSetupPhases{
				Total: 1 * time.Second,
			},
		},
		{
			name:       "empty timestamps",
			timestamps: SessionSetupTimestamps{SessionID: "sess-3"},
			want:       SessionSetupPhases{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.timestamps.Calculate()

			if got.Total != tt.want.Total {
				t.Errorf("Total = %v, want %v", got.Total, tt.want.Total)
			}
			if got.TokenValidation != tt.want.TokenValidation {
				t.Errorf("TokenValidation = %v, want %v", got.TokenValidation, tt.want.TokenValidation)
			}
			if got.WebRTCSetup != tt.want.WebRTCSetup {
				t.Errorf("WebRTCSetup = %v, want %v", got.WebRTCSetup, tt.want.WebRTCSetup)
			}
			if got.IceNegotiation != tt.want.IceNegotiation {
				t.Errorf("IceNegotiation = %v, want %v", got.IceNegotiation, tt.want.IceNegotiation)
			}
			if got.SessionActivation != tt.want.SessionActivation {
				t.Errorf("SessionActivation = %v, want %v", got.SessionActivation, tt.want.SessionActivation)
			}
		})
	}
}

func TestSessionSetupTimestamps_PhaseSumEqualsTotal(t *testing.T) {
	base := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)

	ts := SessionSetupTimestamps{
		SessionID:             "test-session",
		OfferReceived:         base,
		TokenValidated:        base.Add(100 * time.Millisecond),
		PeerConnectionCreated: base.Add(150 * time.Millisecond),
		AnswerSent:            base.Add(200 * time.Millisecond),
		IceComplete:           base.Add(500 * time.Millisecond),
		ConnectionEstablished: base.Add(600 * time.Millisecond),
		SessionActivated:      base.Add(700 * time.Millisecond),
		DataChannelReady:      base.Add(800 * time.Millisecond),
	}

	phases := ts.Calculate()
	sum := phases.TokenValidation + phases.WebRTCSetup + phases.IceNegotiation + phases.SessionActivation

	if sum != phases.Total {
		t.Errorf("phase sum (%v) != total (%v)", sum, phases.Total)
	}
}

func TestSessionSetupCollector_Record(t *testing.T) {
	c := NewSessionSetupCollector(10)

	if c.Count() != 0 {
		t.Errorf("initial count = %d, want 0", c.Count())
	}

	base := time.Now()
	ts := SessionSetupTimestamps{
		SessionID:        "sess-1",
		OfferReceived:    base,
		DataChannelReady: base.Add(500 * time.Millisecond),
	}

	c.Record(ts)

	if c.Count() != 1 {
		t.Errorf("count after record = %d, want 1", c.Count())
	}
}

func TestSessionSetupCollector_RingBuffer(t *testing.T) {
	maxSize := 5
	c := NewSessionSetupCollector(maxSize)

	base := time.Now()
	for i := 0; i < 10; i++ {
		c.Record(SessionSetupTimestamps{
			SessionID:        "sess",
			OfferReceived:    base,
			DataChannelReady: base.Add(time.Duration(i+1) * 100 * time.Millisecond),
		})
	}

	if c.Count() != maxSize {
		t.Errorf("count = %d, want %d (ring buffer should limit)", c.Count(), maxSize)
	}
}

func TestSessionSetupCollector_Stats(t *testing.T) {
	c := NewSessionSetupCollector(100)

	base := time.Now()
	durations := []time.Duration{100, 200, 300, 400, 500, 600, 700, 800, 900, 1000}

	for i, d := range durations {
		c.Record(SessionSetupTimestamps{
			SessionID:        "sess",
			OfferReceived:    base,
			DataChannelReady: base.Add(d * time.Millisecond),
		})
		_ = i
	}

	stats := c.Stats()

	if stats.Count != len(durations) {
		t.Errorf("count = %d, want %d", stats.Count, len(durations))
	}

	if stats.Min != 100*time.Millisecond {
		t.Errorf("min = %v, want 100ms", stats.Min)
	}

	if stats.Max != 1000*time.Millisecond {
		t.Errorf("max = %v, want 1000ms", stats.Max)
	}

	// P50 should be around 500-600ms (median of 10 values)
	if stats.P50 < 400*time.Millisecond || stats.P50 > 700*time.Millisecond {
		t.Errorf("p50 = %v, expected around 500-600ms", stats.P50)
	}
}

func TestSessionSetupCollector_StatsEmpty(t *testing.T) {
	c := NewSessionSetupCollector(100)
	stats := c.Stats()

	if stats.Count != 0 {
		t.Errorf("empty collector count = %d, want 0", stats.Count)
	}
}

func TestSessionSetupCollector_Reset(t *testing.T) {
	c := NewSessionSetupCollector(100)

	base := time.Now()
	c.Record(SessionSetupTimestamps{
		SessionID:        "sess",
		OfferReceived:    base,
		DataChannelReady: base.Add(500 * time.Millisecond),
	})

	if c.Count() != 1 {
		t.Fatalf("count before reset = %d, want 1", c.Count())
	}

	c.Reset()

	if c.Count() != 0 {
		t.Errorf("count after reset = %d, want 0", c.Count())
	}
}
