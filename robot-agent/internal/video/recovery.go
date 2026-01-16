// Package video implements video capture and encoding for the Robot Agent.
package video

import (
	"errors"
	"sync"
	"time"
)

// Recovery errors.
var (
	ErrMaxRetriesExceeded = errors.New("max retries exceeded")
)

// RecoveryConfig configures camera disconnection recovery behavior.
type RecoveryConfig struct {
	MaxRetries    int           // Maximum retry attempts before giving up
	RetryInterval time.Duration // Time to wait between retries
}

// DefaultRecoveryConfig returns sensible defaults for recovery.
func DefaultRecoveryConfig() RecoveryConfig {
	return RecoveryConfig{
		MaxRetries:    5,
		RetryInterval: 100 * time.Millisecond,
	}
}

// CaptureStats holds statistics about capture operations.
type CaptureStats struct {
	FrameCount    uint64 // Total frames captured
	ErrorCount    uint64 // Total errors encountered
	RecoveryCount uint64 // Successful recoveries
}

// RecoverableCapture wraps a CameraSource with automatic recovery.
type RecoverableCapture struct {
	mu             sync.Mutex
	source         CameraSource
	config         CaptureConfig
	recoveryConfig RecoveryConfig
	started        bool
	stats          CaptureStats
	onError        func(error)
	onRecovery     func()
}

// NewRecoverableCapture creates a capture manager with recovery support.
func NewRecoverableCapture(source CameraSource, rc RecoveryConfig) *RecoverableCapture {
	return &RecoverableCapture{
		source:         source,
		recoveryConfig: rc,
	}
}

// Start begins video capture with the given configuration.
func (r *RecoverableCapture) Start(config CaptureConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if err := config.Validate(); err != nil {
		return err
	}

	if err := r.source.Start(config); err != nil {
		return err
	}

	r.config = config
	r.started = true
	r.stats = CaptureStats{}

	return nil
}

// Stop stops video capture.
func (r *RecoverableCapture) Stop() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.started {
		return nil
	}

	r.started = false
	return r.source.Stop()
}

// ReadFrame reads a frame with automatic retry on failure.
func (r *RecoverableCapture) ReadFrame() (*Frame, error) {
	r.mu.Lock()
	if !r.started {
		r.mu.Unlock()
		return nil, ErrCameraNotStarted
	}
	source := r.source
	maxRetries := r.recoveryConfig.MaxRetries
	interval := r.recoveryConfig.RetryInterval
	r.mu.Unlock()

	var lastErr error
	hadError := false

	for attempt := 0; attempt <= maxRetries; attempt++ {
		frame, err := source.ReadFrame()
		if err == nil {
			r.mu.Lock()
			r.stats.FrameCount++
			if hadError {
				r.stats.RecoveryCount++
				if r.onRecovery != nil {
					go r.onRecovery()
				}
			}
			r.mu.Unlock()
			return frame, nil
		}

		lastErr = err
		hadError = true

		r.mu.Lock()
		r.stats.ErrorCount++
		if r.onError != nil {
			go r.onError(err)
		}
		r.mu.Unlock()

		if attempt < maxRetries {
			time.Sleep(interval)
		}
	}

	return nil, errors.Join(ErrMaxRetriesExceeded, lastErr)
}

// OnError sets a callback for capture errors.
func (r *RecoverableCapture) OnError(fn func(error)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.onError = fn
}

// OnRecovery sets a callback for successful recovery.
func (r *RecoverableCapture) OnRecovery(fn func()) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.onRecovery = fn
}

// Stats returns current capture statistics.
func (r *RecoverableCapture) Stats() CaptureStats {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.stats
}

// IsStarted returns true if capture is active.
func (r *RecoverableCapture) IsStarted() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.started
}

// Config returns the current capture configuration.
func (r *RecoverableCapture) Config() CaptureConfig {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.config
}
