package video

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// FlakySource simulates a camera that can disconnect and reconnect.
type FlakySource struct {
	mu           sync.Mutex
	config       CaptureConfig
	started      bool
	failCount    int32
	maxFails     int32
	sequence     uint64
	disconnected bool
}

func NewFlakySource(maxFails int32) *FlakySource {
	return &FlakySource{maxFails: maxFails}
}

func (f *FlakySource) Start(config CaptureConfig) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.config = config
	f.started = true
	f.disconnected = false
	return nil
}

func (f *FlakySource) Stop() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.started = false
	return nil
}

func (f *FlakySource) ReadFrame() (*Frame, error) {
	f.mu.Lock()
	if !f.started {
		f.mu.Unlock()
		return nil, ErrCameraNotStarted
	}
	if f.disconnected {
		f.mu.Unlock()
		return nil, ErrCameraUnavailable
	}
	config := f.config
	f.mu.Unlock()

	// Simulate failure
	count := atomic.AddInt32(&f.failCount, 1)
	if count <= f.maxFails {
		return nil, ErrCameraUnavailable
	}

	seq := atomic.AddUint64(&f.sequence, 1)
	return &Frame{
		Data:      make([]byte, config.Width*config.Height*3/2),
		Width:     config.Width,
		Height:    config.Height,
		Timestamp: time.Now(),
		Sequence:  seq,
	}, nil
}

func (f *FlakySource) SimulateDisconnect() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.disconnected = true
}

func (f *FlakySource) SimulateReconnect() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.disconnected = false
}

func TestRecoverableCapture_BasicOperation(t *testing.T) {
	source := NewTestPatternSource()
	capture := NewRecoverableCapture(source, DefaultRecoveryConfig())

	err := capture.Start(Config720p())
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer capture.Stop()

	frame, err := capture.ReadFrame()
	if err != nil {
		t.Fatalf("ReadFrame() error = %v", err)
	}

	if frame.Width != 1280 || frame.Height != 720 {
		t.Errorf("Frame dimensions incorrect: %dx%d", frame.Width, frame.Height)
	}
}

func TestRecoverableCapture_TransientFailure(t *testing.T) {
	// Create source that fails 2 times then succeeds
	source := NewFlakySource(2)
	config := RecoveryConfig{
		MaxRetries:    5,
		RetryInterval: 10 * time.Millisecond,
	}
	capture := NewRecoverableCapture(source, config)

	err := capture.Start(Config720p())
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer capture.Stop()

	// Should succeed after retries
	frame, err := capture.ReadFrame()
	if err != nil {
		t.Fatalf("ReadFrame() should succeed after retries, got error = %v", err)
	}

	if frame == nil {
		t.Fatal("ReadFrame() returned nil frame")
	}
}

func TestRecoverableCapture_MaxRetriesExceeded(t *testing.T) {
	// Create source that always fails
	source := NewFlakySource(100)
	config := RecoveryConfig{
		MaxRetries:    3,
		RetryInterval: 5 * time.Millisecond,
	}
	capture := NewRecoverableCapture(source, config)

	err := capture.Start(Config720p())
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer capture.Stop()

	// Should fail after max retries
	_, err = capture.ReadFrame()
	if err == nil {
		t.Fatal("ReadFrame() should fail after max retries")
	}

	if !errors.Is(err, ErrMaxRetriesExceeded) {
		t.Errorf("Expected ErrMaxRetriesExceeded, got %v", err)
	}
}

func TestRecoverableCapture_ErrorCallback(t *testing.T) {
	source := NewFlakySource(2)
	config := RecoveryConfig{
		MaxRetries:    5,
		RetryInterval: 5 * time.Millisecond,
	}
	capture := NewRecoverableCapture(source, config)

	var errorCount int32
	capture.OnError(func(err error) {
		atomic.AddInt32(&errorCount, 1)
	})

	err := capture.Start(Config720p())
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer capture.Stop()

	_, _ = capture.ReadFrame()

	// Should have received 2 error callbacks
	if count := atomic.LoadInt32(&errorCount); count != 2 {
		t.Errorf("Expected 2 error callbacks, got %d", count)
	}
}

func TestRecoverableCapture_RecoveryCallback(t *testing.T) {
	source := NewFlakySource(2)
	config := RecoveryConfig{
		MaxRetries:    5,
		RetryInterval: 5 * time.Millisecond,
	}
	capture := NewRecoverableCapture(source, config)

	var recovered int32
	capture.OnRecovery(func() {
		atomic.AddInt32(&recovered, 1)
	})

	err := capture.Start(Config720p())
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer capture.Stop()

	_, _ = capture.ReadFrame()

	// Wait for goroutine to execute callback
	time.Sleep(20 * time.Millisecond)

	// Should have received recovery callback
	if count := atomic.LoadInt32(&recovered); count != 1 {
		t.Errorf("Expected 1 recovery callback, got %d", count)
	}
}

func TestRecoverableCapture_Stats(t *testing.T) {
	source := NewFlakySource(3)
	config := RecoveryConfig{
		MaxRetries:    5,
		RetryInterval: 5 * time.Millisecond,
	}
	capture := NewRecoverableCapture(source, config)

	err := capture.Start(Config720p())
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer capture.Stop()

	// Read a frame (will have 3 retries)
	_, _ = capture.ReadFrame()

	stats := capture.Stats()
	if stats.ErrorCount != 3 {
		t.Errorf("Expected 3 errors, got %d", stats.ErrorCount)
	}
	if stats.RecoveryCount != 1 {
		t.Errorf("Expected 1 recovery, got %d", stats.RecoveryCount)
	}
}

func TestDefaultRecoveryConfig(t *testing.T) {
	config := DefaultRecoveryConfig()

	if config.MaxRetries <= 0 {
		t.Error("MaxRetries should be positive")
	}
	if config.RetryInterval <= 0 {
		t.Error("RetryInterval should be positive")
	}
}
