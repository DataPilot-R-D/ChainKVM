// Package video implements video capture and encoding for the Robot Agent.
package video

import (
	"sync"
	"sync/atomic"
	"time"
)

// TestPatternSource generates test pattern frames for development/testing.
type TestPatternSource struct {
	mu       sync.Mutex
	config   CaptureConfig
	started  bool
	sequence uint64
}

// NewTestPatternSource creates a new test pattern video source.
func NewTestPatternSource() *TestPatternSource {
	return &TestPatternSource{}
}

// Start initializes the test pattern source.
func (t *TestPatternSource) Start(config CaptureConfig) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.config = config
	t.started = true
	t.sequence = 0
	return nil
}

// Stop stops the test pattern source.
func (t *TestPatternSource) Stop() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.started = false
	return nil
}

// ReadFrame generates a test pattern frame.
func (t *TestPatternSource) ReadFrame() (*Frame, error) {
	t.mu.Lock()
	if !t.started {
		t.mu.Unlock()
		return nil, ErrCameraNotStarted
	}
	config := t.config
	t.mu.Unlock()

	seq := atomic.AddUint64(&t.sequence, 1)

	// Generate simple YUV420 test pattern
	// Y plane: width * height bytes
	// U plane: (width/2) * (height/2) bytes
	// V plane: (width/2) * (height/2) bytes
	ySize := config.Width * config.Height
	uvSize := (config.Width / 2) * (config.Height / 2)
	data := make([]byte, ySize+uvSize*2)

	// Fill Y with gradient based on sequence (creates moving pattern)
	offset := int(seq % 256)
	for y := 0; y < config.Height; y++ {
		for x := 0; x < config.Width; x++ {
			data[y*config.Width+x] = byte((x + y + offset) % 256)
		}
	}

	// Fill U and V with constant (gray)
	for i := ySize; i < len(data); i++ {
		data[i] = 128
	}

	return &Frame{
		Data:      data,
		Width:     config.Width,
		Height:    config.Height,
		Timestamp: time.Now(),
		Sequence:  seq,
	}, nil
}
