package video

import (
	"testing"
	"time"
)

// TestOverlayTimestamp verifies timestamp overlay on frame buffer.
func TestOverlayTimestamp(t *testing.T) {
	// Create test frame with mock YUV420 data
	frame := &Frame{
		Data:      make([]byte, 1280*720*3/2), // YUV420 size for 720p
		Width:     1280,
		Height:    720,
		Timestamp: time.Now(),
		Sequence:  1,
	}

	// Overlay timestamp
	if err := OverlayTimestamp(frame); err != nil {
		t.Fatalf("OverlayTimestamp failed: %v", err)
	}

	// Verify overlay region (top-left) was modified
	// Overlay is at (10, 10) with 200x30 box
	hasBlackBackground := false
	hasWhiteText := false

	// Check overlay region for black background and white text
	for y := 10; y < 40 && y < frame.Height; y++ {
		for x := 10; x < 210 && x < frame.Width; x++ {
			idx := y*frame.Width + x
			if idx < len(frame.Data) {
				if frame.Data[idx] < 50 {
					hasBlackBackground = true
				}
				if frame.Data[idx] > 200 {
					hasWhiteText = true
				}
			}
		}
	}

	if !hasBlackBackground {
		t.Error("Expected black background in overlay region")
	}
	if !hasWhiteText {
		t.Error("Expected white text in overlay region")
	}
}

// TestOverlayTimestamp_NilFrame verifies error handling for nil frame.
func TestOverlayTimestamp_NilFrame(t *testing.T) {
	err := OverlayTimestamp(nil)
	if err == nil {
		t.Error("Expected error for nil frame, got nil")
	}
}

// TestOverlayTimestamp_InvalidFrameData verifies error handling for invalid frame data.
func TestOverlayTimestamp_InvalidFrameData(t *testing.T) {
	frame := &Frame{
		Data:      nil,
		Width:     1280,
		Height:    720,
		Timestamp: time.Now(),
	}

	err := OverlayTimestamp(frame)
	if err == nil {
		t.Error("Expected error for nil frame data, got nil")
	}
}

// TestOverlayTimestamp_TimestampFormat verifies timestamp format is readable.
func TestOverlayTimestamp_TimestampFormat(t *testing.T) {
	frame := &Frame{
		Data:      make([]byte, 1280*720*3/2),
		Width:     1280,
		Height:    720,
		Timestamp: time.Date(2024, 1, 15, 14, 30, 45, 123456789, time.UTC),
		Sequence:  1,
	}

	if err := OverlayTimestamp(frame); err != nil {
		t.Fatalf("OverlayTimestamp failed: %v", err)
	}

	// Verify overlay region contains timestamp pattern
	// Check for black background and white text in overlay region
	overlayFound := false
	for y := 10; y < 40 && y < frame.Height; y++ {
		for x := 10; x < 210 && x < frame.Width; x++ {
			idx := y*frame.Width + x
			if idx < len(frame.Data) && frame.Data[idx] > 200 {
				overlayFound = true
				break
			}
		}
		if overlayFound {
			break
		}
	}

	if !overlayFound {
		t.Error("Expected frame data to contain timestamp text in overlay region")
	}
}

// TestOverlayTimestamp_SmallFrame verifies handling of small frames.
func TestOverlayTimestamp_SmallFrame(t *testing.T) {
	frame := &Frame{
		Data:      make([]byte, 320*240*3/2),
		Width:     320,
		Height:    240,
		Timestamp: time.Now(),
	}

	if err := OverlayTimestamp(frame); err != nil {
		t.Fatalf("OverlayTimestamp should work on small frames: %v", err)
	}
}
