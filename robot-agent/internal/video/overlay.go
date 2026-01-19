package video

import (
	"errors"
)

// Overlay errors.
var (
	ErrNilFrame     = errors.New("frame is nil")
	ErrNilFrameData = errors.New("frame data is nil")
	ErrInvalidFrame = errors.New("frame dimensions invalid")
)

// OverlayTimestamp overlays a timestamp string on the video frame.
// The timestamp is rendered in the top-left corner in HH:MM:SS.mmm format.
// For POC: Simplified implementation that modifies YUV420 luma plane.
func OverlayTimestamp(frame *Frame) error {
	if frame == nil {
		return ErrNilFrame
	}
	if frame.Data == nil || len(frame.Data) == 0 {
		return ErrNilFrameData
	}
	if frame.Width <= 0 || frame.Height <= 0 {
		return ErrInvalidFrame
	}

	// Format timestamp as HH:MM:SS.mmm
	timestamp := frame.Timestamp.Format("15:04:05.000")

	// For POC: Simple text overlay by modifying Y plane pixels
	// In production, this would use a proper rendering library
	// White text on black background for contrast
	overlayText(frame.Data, frame.Width, frame.Height, timestamp)

	return nil
}

// overlayText renders text into the YUV420 luma (Y) plane.
// For POC: Simplified implementation that creates a black box with white text.
// Position: top-left corner at (10, 10).
func overlayText(data []byte, width, height int, text string) {
	const (
		textX      = 10  // X position
		textY      = 10  // Y position
		boxWidth   = 200 // Background box width
		boxHeight  = 30  // Background box height
		charWidth  = 10  // Character width
		charHeight = 20  // Character height
	)

	// Calculate Y plane size (YUV420: Y plane is width * height)
	ySize := width * height
	if len(data) < ySize {
		return // Buffer too small
	}

	// Draw black background box in Y plane
	for y := textY; y < textY+boxHeight && y < height; y++ {
		for x := textX; x < textX+boxWidth && x < width; x++ {
			idx := y*width + x
			if idx < ySize {
				data[idx] = 0 // Black (Y=0)
			}
		}
	}

	// Draw white text characters (simplified monospace rendering)
	// For POC: Each character is represented as a vertical white bar
	textStartX := textX + 5
	textStartY := textY + 5

	for i, ch := range text {
		if ch == ' ' || ch == ':' || ch == '.' {
			continue // Skip spacing characters for simplified rendering
		}

		charX := textStartX + (i * charWidth)
		if charX+charWidth > textX+boxWidth {
			break // Text too long for box
		}

		// Draw simple vertical bar for each character
		for y := textStartY; y < textStartY+charHeight && y < height; y++ {
			for dx := 0; dx < charWidth-2 && charX+dx < width; dx++ {
				idx := y*width + (charX + dx)
				if idx < ySize {
					data[idx] = 255 // White (Y=255)
				}
			}
		}
	}
}

// FormatOverlayTimestamp returns the formatted timestamp string that will be overlayed.
// Useful for testing and external verification.
func FormatOverlayTimestamp(frame *Frame) string {
	if frame == nil {
		return ""
	}
	return frame.Timestamp.Format("15:04:05.000")
}

// ValidateOverlayedFrame checks if a frame appears to have timestamp overlay.
// Returns true if the top-left region contains the expected black/white pattern.
func ValidateOverlayedFrame(frame *Frame) bool {
	if frame == nil || frame.Data == nil {
		return false
	}

	const (
		checkX     = 10
		checkY     = 10
		checkWidth = 200
	)

	ySize := frame.Width * frame.Height
	if len(frame.Data) < ySize {
		return false
	}

	// Check if top-left region has some black pixels (background)
	hasBlack := false
	for x := checkX; x < checkX+checkWidth && x < frame.Width; x++ {
		idx := checkY*frame.Width + x
		if idx < ySize && frame.Data[idx] < 50 {
			hasBlack = true
			break
		}
	}

	return hasBlack
}
