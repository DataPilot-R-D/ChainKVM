package video

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// TimestampSender sends frame timestamp messages via DataChannel
// for video latency measurement.
type TimestampSender struct {
	mu           sync.Mutex
	sender       ResponseSender
	frameCounter uint64
	seqNumber    uint64
	sendInterval int // Send every Nth frame
}

// ResponseSender interface matches datachannel.ResponseSender.
// It abstracts the DataChannel send functionality for testing.
type ResponseSender interface {
	Send(data []byte) error
}

// NewTimestampSender creates a new sender.
// sendInterval controls sampling rate: 1 = every frame, 10 = every 10th frame.
// If sendInterval <= 0, defaults to 10 (reduces DataChannel overhead).
func NewTimestampSender(sender ResponseSender, sendInterval int) *TimestampSender {
	if sendInterval <= 0 {
		sendInterval = 10 // Default: every 10th frame (~3 Hz at 30fps)
	}
	return &TimestampSender{
		sender:       sender,
		sendInterval: sendInterval,
	}
}

// SendFrameTimestamp sends timestamp for current frame.
// Returns nil if this frame should be skipped based on sendInterval.
// Returns error if marshaling or sending fails.
func (s *TimestampSender) SendFrameTimestamp(frameTime time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.frameCounter++

	// Only send every Nth frame
	if s.frameCounter%uint64(s.sendInterval) != 0 {
		return nil
	}

	s.seqNumber++

	msg := protocol.FrameTimestampMessage{
		Type:           protocol.TypeFrameTimestamp,
		Timestamp:      frameTime.UnixMilli(),
		FrameID:        s.frameCounter,
		SequenceNumber: s.seqNumber,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return s.sender.Send(data)
}

// GetStats returns current sender statistics.
func (s *TimestampSender) GetStats() (frameCount, sentCount uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.frameCounter, s.seqNumber
}
