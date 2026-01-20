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

