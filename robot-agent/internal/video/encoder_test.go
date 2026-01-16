package video

import (
	"testing"
)

func TestEncoderConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  EncoderConfig
		wantErr bool
	}{
		{
			name: "valid VP8 config",
			config: EncoderConfig{
				Codec:   CodecVP8,
				Bitrate: 2_000_000,
				Keyframe: 30,
			},
			wantErr: false,
		},
		{
			name: "valid H264 config",
			config: EncoderConfig{
				Codec:   CodecH264,
				Bitrate: 4_000_000,
				Keyframe: 60,
			},
			wantErr: false,
		},
		{
			name: "invalid codec",
			config: EncoderConfig{
				Codec:   "invalid",
				Bitrate: 2_000_000,
				Keyframe: 30,
			},
			wantErr: true,
		},
		{
			name: "zero bitrate",
			config: EncoderConfig{
				Codec:   CodecVP8,
				Bitrate: 0,
				Keyframe: 30,
			},
			wantErr: true,
		},
		{
			name: "negative keyframe",
			config: EncoderConfig{
				Codec:   CodecVP8,
				Bitrate: 2_000_000,
				Keyframe: -1,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEncodedFrame_IsKeyframe(t *testing.T) {
	tests := []struct {
		name     string
		frame    EncodedFrame
		expected bool
	}{
		{
			name:     "keyframe",
			frame:    EncodedFrame{Keyframe: true},
			expected: true,
		},
		{
			name:     "non-keyframe",
			frame:    EncodedFrame{Keyframe: false},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.frame.IsKeyframe() != tt.expected {
				t.Errorf("IsKeyframe() = %v, expected %v", tt.frame.IsKeyframe(), tt.expected)
			}
		})
	}
}

func TestSoftwareEncoder_Encode(t *testing.T) {
	encoder := NewSoftwareEncoder()

	config := EncoderConfig{
		Codec:    CodecVP8,
		Bitrate:  2_000_000,
		Keyframe: 30,
	}

	err := encoder.Start(config)
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer encoder.Stop()

	// Create a test frame (720p YUV420)
	frame := &Frame{
		Width:  1280,
		Height: 720,
		Data:   make([]byte, 1280*720*3/2), // YUV420
	}

	encoded, err := encoder.Encode(frame)
	if err != nil {
		t.Fatalf("Encode() error = %v", err)
	}

	if encoded == nil {
		t.Fatal("Encode() returned nil frame")
	}

	if len(encoded.Data) == 0 {
		t.Error("Encode() returned empty data")
	}

	if encoded.Width != frame.Width || encoded.Height != frame.Height {
		t.Errorf("Encoded dimensions mismatch: got %dx%d, want %dx%d",
			encoded.Width, encoded.Height, frame.Width, frame.Height)
	}
}

func TestSoftwareEncoder_KeyframeInterval(t *testing.T) {
	encoder := NewSoftwareEncoder()

	config := EncoderConfig{
		Codec:    CodecVP8,
		Bitrate:  2_000_000,
		Keyframe: 3, // Keyframe every 3 frames
	}

	err := encoder.Start(config)
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer encoder.Stop()

	frame := &Frame{
		Width:  640,
		Height: 480,
		Data:   make([]byte, 640*480*3/2),
	}

	// Encode several frames and check keyframe pattern
	keyframeCount := 0
	for i := 0; i < 9; i++ {
		encoded, err := encoder.Encode(frame)
		if err != nil {
			t.Fatalf("Encode() frame %d error = %v", i, err)
		}
		if encoded.IsKeyframe() {
			keyframeCount++
		}
	}

	// Should have keyframes at 0, 3, 6 = 3 keyframes
	if keyframeCount != 3 {
		t.Errorf("Expected 3 keyframes, got %d", keyframeCount)
	}
}

func TestSoftwareEncoder_NotStarted(t *testing.T) {
	encoder := NewSoftwareEncoder()

	frame := &Frame{
		Width:  640,
		Height: 480,
		Data:   make([]byte, 640*480*3/2),
	}

	_, err := encoder.Encode(frame)
	if err != ErrEncoderNotStarted {
		t.Errorf("Expected ErrEncoderNotStarted, got %v", err)
	}
}

func TestSoftwareEncoder_ForceKeyframe(t *testing.T) {
	encoder := NewSoftwareEncoder()

	config := EncoderConfig{
		Codec:    CodecVP8,
		Bitrate:  2_000_000,
		Keyframe: 100, // Large interval
	}

	err := encoder.Start(config)
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer encoder.Stop()

	frame := &Frame{
		Width:  640,
		Height: 480,
		Data:   make([]byte, 640*480*3/2),
	}

	// First frame is always keyframe
	encoded, _ := encoder.Encode(frame)
	if !encoded.IsKeyframe() {
		t.Error("First frame should be keyframe")
	}

	// Second frame should not be keyframe
	encoded, _ = encoder.Encode(frame)
	if encoded.IsKeyframe() {
		t.Error("Second frame should not be keyframe")
	}

	// Force keyframe
	encoder.ForceKeyframe()

	// Next frame should be keyframe
	encoded, _ = encoder.Encode(frame)
	if !encoded.IsKeyframe() {
		t.Error("Frame after ForceKeyframe should be keyframe")
	}
}
