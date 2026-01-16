package video

import (
	"testing"
)

func TestTestPatternSource_Start(t *testing.T) {
	src := NewTestPatternSource()

	err := src.Start(Config720p())
	if err != nil {
		t.Fatalf("failed to start: %v", err)
	}

	err = src.Stop()
	if err != nil {
		t.Fatalf("failed to stop: %v", err)
	}
}

func TestTestPatternSource_ReadFrame(t *testing.T) {
	src := NewTestPatternSource()
	cfg := Config720p()

	src.Start(cfg)
	defer src.Stop()

	frame, err := src.ReadFrame()
	if err != nil {
		t.Fatalf("failed to read frame: %v", err)
	}

	if frame.Width != cfg.Width || frame.Height != cfg.Height {
		t.Errorf("expected %dx%d, got %dx%d",
			cfg.Width, cfg.Height, frame.Width, frame.Height)
	}

	// Check YUV420 data size
	expectedSize := cfg.Width*cfg.Height + 2*(cfg.Width/2)*(cfg.Height/2)
	if len(frame.Data) != expectedSize {
		t.Errorf("expected data size %d, got %d", expectedSize, len(frame.Data))
	}

	if frame.Sequence != 1 {
		t.Errorf("expected sequence 1, got %d", frame.Sequence)
	}
}

func TestTestPatternSource_SequenceIncrement(t *testing.T) {
	src := NewTestPatternSource()

	src.Start(Config720p())
	defer src.Stop()

	for i := uint64(1); i <= 5; i++ {
		frame, err := src.ReadFrame()
		if err != nil {
			t.Fatalf("failed to read frame %d: %v", i, err)
		}
		if frame.Sequence != i {
			t.Errorf("expected sequence %d, got %d", i, frame.Sequence)
		}
	}
}

func TestTestPatternSource_NotStarted(t *testing.T) {
	src := NewTestPatternSource()

	_, err := src.ReadFrame()
	if err != ErrCameraNotStarted {
		t.Errorf("expected ErrCameraNotStarted, got %v", err)
	}
}

func TestTestPatternSource_PatternChanges(t *testing.T) {
	src := NewTestPatternSource()

	src.Start(Config720p())
	defer src.Stop()

	frame1, _ := src.ReadFrame()
	frame2, _ := src.ReadFrame()

	// Pattern should change between frames
	if frame1.Data[0] == frame2.Data[0] && frame1.Data[100] == frame2.Data[100] {
		t.Error("pattern should change between frames")
	}
}
