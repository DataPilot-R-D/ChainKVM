// Package video implements video capture and encoding for the Robot Agent.
package video

import (
	"errors"
	"sync"
	"time"
)

// Codec types supported by the encoder.
const (
	CodecVP8  = "VP8"
	CodecH264 = "H264"
)

// Encoder errors.
var (
	ErrEncoderNotStarted = errors.New("encoder not started")
	ErrInvalidCodec      = errors.New("invalid codec")
)

// EncoderConfig holds video encoder configuration.
type EncoderConfig struct {
	Codec    string // Codec type (VP8, H264)
	Bitrate  int    // Target bitrate in bits per second
	Keyframe int    // Keyframe interval in frames
}

// Validate checks if the encoder configuration is valid.
func (c *EncoderConfig) Validate() error {
	if c.Codec != CodecVP8 && c.Codec != CodecH264 {
		return ErrInvalidCodec
	}
	if c.Bitrate <= 0 {
		return errors.New("bitrate must be positive")
	}
	if c.Keyframe < 0 {
		return errors.New("keyframe interval must be non-negative")
	}
	return nil
}

// DefaultEncoderConfig returns a default encoder configuration for VP8.
func DefaultEncoderConfig() EncoderConfig {
	return EncoderConfig{
		Codec:    CodecVP8,
		Bitrate:  2_000_000,
		Keyframe: 30,
	}
}

// EncodedFrame represents an encoded video frame.
type EncodedFrame struct {
	Data      []byte    // Encoded frame data
	Width     int       // Frame width
	Height    int       // Frame height
	Timestamp time.Time // Original capture timestamp
	Sequence  uint64    // Frame sequence number
	Keyframe  bool      // True if this is a keyframe
	Codec     string    // Codec used for encoding
}

// IsKeyframe returns true if this is a keyframe.
func (f *EncodedFrame) IsKeyframe() bool {
	return f.Keyframe
}

// Encoder is the interface for video encoders.
type Encoder interface {
	Start(config EncoderConfig) error
	Stop() error
	Encode(frame *Frame) (*EncodedFrame, error)
	ForceKeyframe()
}

// SoftwareEncoder implements a software-based video encoder.
// For POC, this simulates encoding without actual codec implementation.
type SoftwareEncoder struct {
	mu             sync.Mutex
	config         EncoderConfig
	started        bool
	frameCount     uint64
	forceKeyframe  bool
}

// NewSoftwareEncoder creates a new software encoder.
func NewSoftwareEncoder() *SoftwareEncoder {
	return &SoftwareEncoder{}
}

// Start initializes the encoder with the given configuration.
func (e *SoftwareEncoder) Start(config EncoderConfig) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if err := config.Validate(); err != nil {
		return err
	}

	e.config = config
	e.started = true
	e.frameCount = 0
	e.forceKeyframe = false

	return nil
}

// Stop stops the encoder.
func (e *SoftwareEncoder) Stop() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.started = false
	return nil
}

// Encode encodes a raw frame to the configured codec.
func (e *SoftwareEncoder) Encode(frame *Frame) (*EncodedFrame, error) {
	e.mu.Lock()
	if !e.started {
		e.mu.Unlock()
		return nil, ErrEncoderNotStarted
	}

	config := e.config
	frameNum := e.frameCount
	e.frameCount++

	isKeyframe := e.forceKeyframe || frameNum == 0 ||
		(config.Keyframe > 0 && frameNum%uint64(config.Keyframe) == 0)

	if e.forceKeyframe {
		e.forceKeyframe = false
	}
	e.mu.Unlock()

	// Overlay timestamp for latency measurement (M6-003)
	if err := OverlayTimestamp(frame); err != nil {
		// Log warning but don't fail encoding - overlay is optional for measurement
		// In production, this would use proper logging
		_ = err // Suppress unused error for POC
	}

	// Simulate encoding - in production, use actual codec library
	// For POC, we compress by simple placeholder encoding
	encoded := simulateEncode(frame.Data, isKeyframe)

	return &EncodedFrame{
		Data:      encoded,
		Width:     frame.Width,
		Height:    frame.Height,
		Timestamp: frame.Timestamp,
		Sequence:  frame.Sequence,
		Keyframe:  isKeyframe,
		Codec:     config.Codec,
	}, nil
}

// ForceKeyframe forces the next encoded frame to be a keyframe.
func (e *SoftwareEncoder) ForceKeyframe() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.forceKeyframe = true
}

// simulateEncode simulates video encoding for POC.
// In production, this would use libvpx or x264.
func simulateEncode(data []byte, keyframe bool) []byte {
	// For POC: create a placeholder encoded frame
	// Real implementation would use actual codec
	header := []byte{0x00} // Placeholder header
	if keyframe {
		header[0] = 0x01 // Mark keyframe
	}

	// Simulate compression ratio (~10x for demonstration)
	compressedSize := len(data) / 10
	if compressedSize < 100 {
		compressedSize = 100
	}

	encoded := make([]byte, len(header)+compressedSize)
	copy(encoded, header)

	// Fill with simulated compressed data
	for i := len(header); i < len(encoded); i++ {
		if i < len(data) {
			encoded[i] = data[i] ^ 0x55 // Simple XOR "compression"
		}
	}

	return encoded
}
