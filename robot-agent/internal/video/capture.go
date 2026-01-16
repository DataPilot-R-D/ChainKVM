// Package video implements video capture and encoding for the Robot Agent.
package video

import (
	"context"
	"errors"
	"sync"
	"time"
)

// Error definitions.
var (
	ErrCameraNotStarted  = errors.New("camera not started")
	ErrInvalidConfig     = errors.New("invalid capture configuration")
	ErrCameraUnavailable = errors.New("camera unavailable")
)

// Frame represents a captured video frame.
type Frame struct {
	Data      []byte    // Raw frame data (YUV420 or similar)
	Width     int       // Frame width in pixels
	Height    int       // Frame height in pixels
	Timestamp time.Time // Capture timestamp for latency measurement
	Sequence  uint64    // Frame sequence number
}

// Age returns the time elapsed since frame capture.
func (f *Frame) Age() time.Duration {
	return time.Since(f.Timestamp)
}

// CaptureConfig holds video capture configuration.
type CaptureConfig struct {
	Width     int // Frame width in pixels
	Height    int // Frame height in pixels
	FrameRate int // Target frames per second
}

// Validate checks if the configuration is valid.
func (c *CaptureConfig) Validate() error {
	if c.Width <= 0 {
		return errors.New("width must be positive")
	}
	if c.Height <= 0 {
		return errors.New("height must be positive")
	}
	if c.FrameRate <= 0 || c.FrameRate > 120 {
		return errors.New("frame rate must be between 1 and 120")
	}
	return nil
}

// Config720p returns a preset configuration for 720p at 30fps.
func Config720p() CaptureConfig {
	return CaptureConfig{
		Width:     1280,
		Height:    720,
		FrameRate: 30,
	}
}

// Config1080p returns a preset configuration for 1080p at 30fps.
func Config1080p() CaptureConfig {
	return CaptureConfig{
		Width:     1920,
		Height:    1080,
		FrameRate: 30,
	}
}

// CameraSource is the interface for camera hardware abstraction.
type CameraSource interface {
	Start(config CaptureConfig) error
	Stop() error
	ReadFrame() (*Frame, error)
}

// Capture manages video capture from a camera source.
type Capture struct {
	mu      sync.Mutex
	camera  CameraSource
	config  CaptureConfig
	started bool
	stopCh  chan struct{}
}

// NewCapture creates a new video capture manager.
func NewCapture(camera CameraSource) *Capture {
	return &Capture{
		camera: camera,
	}
}

// Start begins video capture with the given configuration.
func (c *Capture) Start(config CaptureConfig) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := config.Validate(); err != nil {
		return err
	}

	if err := c.camera.Start(config); err != nil {
		return err
	}

	c.config = config
	c.started = true
	c.stopCh = make(chan struct{})

	return nil
}

// Stop stops video capture.
func (c *Capture) Stop() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.started {
		return nil
	}

	if c.stopCh != nil {
		close(c.stopCh)
	}

	c.started = false
	return c.camera.Stop()
}

// IsStarted returns true if capture is active.
func (c *Capture) IsStarted() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.started
}

// ReadFrame reads a single frame from the camera.
func (c *Capture) ReadFrame() (*Frame, error) {
	c.mu.Lock()
	started := c.started
	c.mu.Unlock()

	if !started {
		return nil, ErrCameraNotStarted
	}

	return c.camera.ReadFrame()
}

// Frames returns a channel that produces frames until context is cancelled.
func (c *Capture) Frames(ctx context.Context) <-chan *Frame {
	frameCh := make(chan *Frame)

	go func() {
		defer close(frameCh)

		c.mu.Lock()
		frameRate := c.config.FrameRate
		stopCh := c.stopCh
		c.mu.Unlock()

		if frameRate <= 0 {
			frameRate = 30
		}
		ticker := time.NewTicker(time.Second / time.Duration(frameRate))
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-stopCh:
				return
			case <-ticker.C:
				frame, err := c.ReadFrame()
				if err != nil {
					continue // Skip frame on error
				}

				select {
				case frameCh <- frame:
				case <-ctx.Done():
					return
				case <-stopCh:
					return
				}
			}
		}
	}()

	return frameCh
}

// Config returns the current capture configuration.
func (c *Capture) Config() CaptureConfig {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.config
}
