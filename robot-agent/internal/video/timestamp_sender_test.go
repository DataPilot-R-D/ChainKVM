package video

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// mockSender implements ResponseSender for testing.
type mockSender struct {
	sent [][]byte
	fail bool
}

func (m *mockSender) Send(data []byte) error {
	if m.fail {
		return errors.New("send failed")
	}
	m.sent = append(m.sent, data)
	return nil
}

func TestNewTimestampSender(t *testing.T) {
	sender := &mockSender{}

	tests := []struct {
		name            string
		sendInterval    int
		expectedInterval int
	}{
		{"positive interval", 5, 5},
		{"default on zero", 0, 10},
		{"default on negative", -1, 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ts := NewTimestampSender(sender, tt.sendInterval)
			if ts.sendInterval != tt.expectedInterval {
				t.Errorf("Expected sendInterval %d, got %d", tt.expectedInterval, ts.sendInterval)
			}
		})
	}
}

func TestTimestampSender_SendInterval(t *testing.T) {
	sender := &mockSender{}
	ts := NewTimestampSender(sender, 3) // Send every 3rd frame

	// Send 10 frames
	for i := 0; i < 10; i++ {
		frameTime := time.Now()
		if err := ts.SendFrameTimestamp(frameTime); err != nil {
			t.Fatalf("SendFrameTimestamp failed: %v", err)
		}
	}

	// Should have sent frames 3, 6, 9 = 3 messages
	expectedSent := 3
	if len(sender.sent) != expectedSent {
		t.Errorf("Expected %d messages sent, got %d", expectedSent, len(sender.sent))
	}
}

func TestTimestampSender_MessageFormat(t *testing.T) {
	sender := &mockSender{}
	ts := NewTimestampSender(sender, 1) // Send every frame

	frameTime := time.Date(2025, 1, 20, 12, 0, 0, 0, time.UTC)

	if err := ts.SendFrameTimestamp(frameTime); err != nil {
		t.Fatalf("SendFrameTimestamp failed: %v", err)
	}

	if len(sender.sent) != 1 {
		t.Fatalf("Expected 1 message sent, got %d", len(sender.sent))
	}

	var msg protocol.FrameTimestampMessage
	if err := json.Unmarshal(sender.sent[0], &msg); err != nil {
		t.Fatalf("Failed to unmarshal message: %v", err)
	}

	// Verify message structure
	if msg.Type != protocol.TypeFrameTimestamp {
		t.Errorf("Expected type %s, got %s", protocol.TypeFrameTimestamp, msg.Type)
	}
	if msg.Timestamp != frameTime.UnixMilli() {
		t.Errorf("Expected timestamp %d, got %d", frameTime.UnixMilli(), msg.Timestamp)
	}
	if msg.FrameID != 1 {
		t.Errorf("Expected FrameID 1, got %d", msg.FrameID)
	}
	if msg.SequenceNumber != 1 {
		t.Errorf("Expected SequenceNumber 1, got %d", msg.SequenceNumber)
	}
}

func TestTimestampSender_SequenceMonotonicity(t *testing.T) {
	sender := &mockSender{}
	ts := NewTimestampSender(sender, 1) // Send every frame

	// Send 5 frames
	for i := 0; i < 5; i++ {
		if err := ts.SendFrameTimestamp(time.Now()); err != nil {
			t.Fatalf("SendFrameTimestamp failed: %v", err)
		}
	}

	if len(sender.sent) != 5 {
		t.Fatalf("Expected 5 messages, got %d", len(sender.sent))
	}

	// Verify sequence numbers are monotonically increasing
	for i, data := range sender.sent {
		var msg protocol.FrameTimestampMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			t.Fatalf("Failed to unmarshal message %d: %v", i, err)
		}
		expectedSeq := uint64(i + 1)
		if msg.SequenceNumber != expectedSeq {
			t.Errorf("Frame %d: expected sequence %d, got %d", i, expectedSeq, msg.SequenceNumber)
		}
	}
}

func TestTimestampSender_FrameIDIncrement(t *testing.T) {
	sender := &mockSender{}
	ts := NewTimestampSender(sender, 2) // Send every 2nd frame

	// Send 6 frames
	for i := 0; i < 6; i++ {
		if err := ts.SendFrameTimestamp(time.Now()); err != nil {
			t.Fatalf("SendFrameTimestamp failed: %v", err)
		}
	}

	// Should send at frames 2, 4, 6
	if len(sender.sent) != 3 {
		t.Fatalf("Expected 3 messages, got %d", len(sender.sent))
	}

	expectedFrameIDs := []uint64{2, 4, 6}
	for i, data := range sender.sent {
		var msg protocol.FrameTimestampMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			t.Fatalf("Failed to unmarshal message %d: %v", i, err)
		}
		if msg.FrameID != expectedFrameIDs[i] {
			t.Errorf("Message %d: expected FrameID %d, got %d", i, expectedFrameIDs[i], msg.FrameID)
		}
	}
}

func TestTimestampSender_ErrorHandling(t *testing.T) {
	sender := &mockSender{fail: true}
	ts := NewTimestampSender(sender, 1)

	err := ts.SendFrameTimestamp(time.Now())
	if err == nil {
		t.Error("Expected error when sender fails, got nil")
	}
}

func TestTimestampSender_GetStats(t *testing.T) {
	sender := &mockSender{}
	ts := NewTimestampSender(sender, 3) // Send every 3rd frame

	// Send 10 frames
	for i := 0; i < 10; i++ {
		if err := ts.SendFrameTimestamp(time.Now()); err != nil {
			t.Fatalf("SendFrameTimestamp failed: %v", err)
		}
	}

	frameCount, sentCount := ts.GetStats()

	if frameCount != 10 {
		t.Errorf("Expected frameCount 10, got %d", frameCount)
	}
	// Sent at frames 3, 6, 9
	if sentCount != 3 {
		t.Errorf("Expected sentCount 3, got %d", sentCount)
	}
}

func TestTimestampSender_ConcurrentAccess(t *testing.T) {
	sender := &mockSender{}
	ts := NewTimestampSender(sender, 1)

	done := make(chan bool)
	iterations := 100

	// Start 3 concurrent senders
	for worker := 0; worker < 3; worker++ {
		go func() {
			for i := 0; i < iterations; i++ {
				_ = ts.SendFrameTimestamp(time.Now())
			}
			done <- true
		}()
	}

	// Wait for all workers
	for i := 0; i < 3; i++ {
		<-done
	}

	frameCount, sentCount := ts.GetStats()

	// Should have processed 300 frames total
	if frameCount != 300 {
		t.Errorf("Expected 300 frames, got %d", frameCount)
	}
	if sentCount != 300 {
		t.Errorf("Expected 300 sent, got %d", sentCount)
	}
}
