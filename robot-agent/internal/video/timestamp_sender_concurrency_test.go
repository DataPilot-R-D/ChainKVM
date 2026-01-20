package video

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

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

func TestTimestampSender_JSONStructureCompatibility(t *testing.T) {
	sender := &mockSender{}
	ts := NewTimestampSender(sender, 1)

	frameTime := time.Date(2025, 1, 20, 12, 0, 0, 0, time.UTC)
	if err := ts.SendFrameTimestamp(frameTime); err != nil {
		t.Fatalf("SendFrameTimestamp failed: %v", err)
	}

	if len(sender.sent) != 1 {
		t.Fatalf("Expected 1 message sent, got %d", len(sender.sent))
	}

	// Unmarshal into raw map to verify exact structure
	var raw map[string]interface{}
	if err := json.Unmarshal(sender.sent[0], &raw); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	// Verify all required fields exist with correct types
	if raw["type"] != "frame_timestamp" {
		t.Errorf("Expected type 'frame_timestamp', got %v", raw["type"])
	}

	// JSON numbers are unmarshaled as float64
	if _, ok := raw["timestamp"].(float64); !ok {
		t.Errorf("Expected timestamp to be number, got %T", raw["timestamp"])
	}
	if _, ok := raw["frame_id"].(float64); !ok {
		t.Errorf("Expected frame_id to be number, got %T", raw["frame_id"])
	}
	if _, ok := raw["sequence_number"].(float64); !ok {
		t.Errorf("Expected sequence_number to be number, got %T", raw["sequence_number"])
	}

	// Verify no unexpected fields (must have exactly 4 fields)
	if len(raw) != 4 {
		t.Errorf("Expected exactly 4 fields, got %d: %v", len(raw), raw)
	}
}

func TestTimestampSender_RecoveryAfterSendFailure(t *testing.T) {
	sender := &mockSender{fail: true}
	ts := NewTimestampSender(sender, 1)

	// First send fails
	err := ts.SendFrameTimestamp(time.Now())
	if err == nil {
		t.Error("Expected error on first send")
	}

	// Second send succeeds
	sender.fail = false
	err = ts.SendFrameTimestamp(time.Now())
	if err != nil {
		t.Errorf("Expected success on second send, got: %v", err)
	}

	// Verify we have exactly one sent message
	if len(sender.sent) != 1 {
		t.Fatalf("Expected 1 message sent, got %d", len(sender.sent))
	}

	// Verify sequence number is correct (should be 2 since frame 2 succeeded)
	var msg protocol.FrameTimestampMessage
	if err := json.Unmarshal(sender.sent[0], &msg); err != nil {
		t.Fatalf("Failed to unmarshal message: %v", err)
	}
	if msg.SequenceNumber != 2 {
		t.Errorf("Expected SequenceNumber 2, got %d", msg.SequenceNumber)
	}
}
