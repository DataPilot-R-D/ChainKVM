package video

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestCaptureConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  CaptureConfig
		wantErr bool
	}{
		{
			name: "valid 720p 30fps",
			config: CaptureConfig{
				Width:     1280,
				Height:    720,
				FrameRate: 30,
			},
			wantErr: false,
		},
		{
			name: "valid 1080p 60fps",
			config: CaptureConfig{
				Width:     1920,
				Height:    1080,
				FrameRate: 60,
			},
			wantErr: false,
		},
		{
			name: "invalid zero width",
			config: CaptureConfig{
				Width:     0,
				Height:    720,
				FrameRate: 30,
			},
			wantErr: true,
		},
		{
			name: "invalid zero height",
			config: CaptureConfig{
				Width:     1280,
				Height:    0,
				FrameRate: 30,
			},
			wantErr: true,
		},
		{
			name: "invalid zero framerate",
			config: CaptureConfig{
				Width:     1280,
				Height:    720,
				FrameRate: 0,
			},
			wantErr: true,
		},
		{
			name: "invalid high framerate",
			config: CaptureConfig{
				Width:     1280,
				Height:    720,
				FrameRate: 200,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if tt.wantErr && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestCaptureConfig_Presets(t *testing.T) {
	t.Run("720p preset", func(t *testing.T) {
		cfg := Config720p()
		if cfg.Width != 1280 || cfg.Height != 720 {
			t.Errorf("expected 1280x720, got %dx%d", cfg.Width, cfg.Height)
		}
		if cfg.FrameRate != 30 {
			t.Errorf("expected 30fps, got %d", cfg.FrameRate)
		}
	})

	t.Run("1080p preset", func(t *testing.T) {
		cfg := Config1080p()
		if cfg.Width != 1920 || cfg.Height != 1080 {
			t.Errorf("expected 1920x1080, got %dx%d", cfg.Width, cfg.Height)
		}
	})
}

// mockCamera simulates a camera for testing.
type mockCamera struct {
	mu        sync.Mutex
	started   bool
	stopped   bool
	config    CaptureConfig
	failStart bool
	failRead  bool
	frames    int
}

func (m *mockCamera) Start(config CaptureConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.failStart {
		return errors.New("camera start failed")
	}

	m.started = true
	m.config = config
	return nil
}

func (m *mockCamera) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.stopped = true
	m.started = false
	return nil
}

func (m *mockCamera) ReadFrame() (*Frame, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.failRead {
		return nil, errors.New("camera read failed")
	}

	if !m.started {
		return nil, ErrCameraNotStarted
	}

	m.frames++
	return &Frame{
		Data:      make([]byte, m.config.Width*m.config.Height*3/2), // YUV420
		Width:     m.config.Width,
		Height:    m.config.Height,
		Timestamp: time.Now(),
		Sequence:  uint64(m.frames),
	}, nil
}

func (m *mockCamera) IsStarted() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.started
}

func TestCapture_StartStop(t *testing.T) {
	cam := &mockCamera{}
	cap := NewCapture(cam)

	cfg := Config720p()

	// Start capture
	err := cap.Start(cfg)
	if err != nil {
		t.Fatalf("failed to start: %v", err)
	}

	if !cam.IsStarted() {
		t.Error("camera should be started")
	}

	// Stop capture
	err = cap.Stop()
	if err != nil {
		t.Fatalf("failed to stop: %v", err)
	}

	if cam.IsStarted() {
		t.Error("camera should be stopped")
	}
}

func TestCapture_StartFailure(t *testing.T) {
	cam := &mockCamera{failStart: true}
	cap := NewCapture(cam)

	err := cap.Start(Config720p())
	if err == nil {
		t.Error("expected start to fail")
	}
}

func TestCapture_ReadFrame(t *testing.T) {
	cam := &mockCamera{}
	cap := NewCapture(cam)

	cfg := Config720p()
	cap.Start(cfg)
	defer cap.Stop()

	frame, err := cap.ReadFrame()
	if err != nil {
		t.Fatalf("failed to read frame: %v", err)
	}

	if frame.Width != cfg.Width || frame.Height != cfg.Height {
		t.Errorf("expected %dx%d, got %dx%d",
			cfg.Width, cfg.Height, frame.Width, frame.Height)
	}

	if frame.Timestamp.IsZero() {
		t.Error("frame should have timestamp")
	}

	if frame.Sequence != 1 {
		t.Errorf("expected sequence 1, got %d", frame.Sequence)
	}
}

func TestCapture_ReadFrameNotStarted(t *testing.T) {
	cam := &mockCamera{}
	cap := NewCapture(cam)

	_, err := cap.ReadFrame()
	if !errors.Is(err, ErrCameraNotStarted) {
		t.Errorf("expected ErrCameraNotStarted, got %v", err)
	}
}

func TestCapture_FrameChannel(t *testing.T) {
	cam := &mockCamera{}
	cap := NewCapture(cam)

	cfg := Config720p()
	cap.Start(cfg)

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	frameCh := cap.Frames(ctx)

	// Read a few frames
	count := 0
	for frame := range frameCh {
		if frame.Width != cfg.Width {
			t.Errorf("wrong width: %d", frame.Width)
		}
		count++
		if count >= 3 {
			cancel()
		}
	}

	if count < 3 {
		t.Errorf("expected at least 3 frames, got %d", count)
	}

	cap.Stop()
}

func TestFrame_HasTimestamp(t *testing.T) {
	frame := &Frame{
		Data:      []byte{1, 2, 3},
		Width:     640,
		Height:    480,
		Timestamp: time.Now(),
		Sequence:  1,
	}

	if frame.Timestamp.IsZero() {
		t.Error("frame should have non-zero timestamp")
	}

	// Check age calculation
	time.Sleep(10 * time.Millisecond)
	age := frame.Age()
	if age < 10*time.Millisecond {
		t.Errorf("expected age >= 10ms, got %v", age)
	}
}
