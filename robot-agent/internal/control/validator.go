// Package control implements control command handling for the Robot Agent.
package control

import (
	"fmt"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// Validation error codes.
const (
	ErrOutOfRange        = "OUT_OF_RANGE"
	ErrStaleCommand      = "STALE_COMMAND"
	ErrInvalidTimestamp  = "INVALID_TIMESTAMP"
	ErrMissingField      = "MISSING_FIELD"
	ErrInvalidValue      = "INVALID_VALUE"
)

// ValidationError represents a command validation failure.
type ValidationError struct {
	Code    string
	Message string
	Field   string
}

func (e *ValidationError) Error() string {
	if e.Field != "" {
		return fmt.Sprintf("%s: %s (field: %s)", e.Code, e.Message, e.Field)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Validator validates incoming control messages.
type Validator struct {
	staleThreshold time.Duration
}

// NewValidator creates a new message validator.
func NewValidator(staleThreshold time.Duration) *Validator {
	return &Validator{
		staleThreshold: staleThreshold,
	}
}

// ValidateDrive validates a drive command message.
func (v *Validator) ValidateDrive(msg *protocol.DriveMessage) error {
	if err := v.checkStale(msg.T); err != nil {
		return err
	}

	// Validate velocity ranges [-1, 1]
	if msg.V < -1.0 || msg.V > 1.0 {
		return &ValidationError{
			Code:    ErrOutOfRange,
			Message: "linear velocity must be in range [-1, 1]",
			Field:   "v",
		}
	}

	if msg.W < -1.0 || msg.W > 1.0 {
		return &ValidationError{
			Code:    ErrOutOfRange,
			Message: "angular velocity must be in range [-1, 1]",
			Field:   "w",
		}
	}

	return nil
}

// ValidateKVMKey validates a keyboard input message.
func (v *Validator) ValidateKVMKey(msg *protocol.KVMKeyMessage) error {
	if err := v.checkStale(msg.T); err != nil {
		return err
	}

	if msg.Key == "" {
		return &ValidationError{
			Code:    ErrMissingField,
			Message: "key is required",
			Field:   "key",
		}
	}

	if msg.Action != "down" && msg.Action != "up" {
		return &ValidationError{
			Code:    ErrInvalidValue,
			Message: "action must be 'down' or 'up'",
			Field:   "action",
		}
	}

	return nil
}

// ValidateKVMMouse validates a mouse input message.
func (v *Validator) ValidateKVMMouse(msg *protocol.KVMMouseMessage) error {
	if err := v.checkStale(msg.T); err != nil {
		return err
	}

	// Mouse movements are clamped, not rejected
	// No additional validation needed
	return nil
}

// ValidateEStop validates an emergency stop message.
// E-Stop is always accepted for safety, even if stale.
func (v *Validator) ValidateEStop(msg *protocol.EStopMessage) error {
	// E-Stop is always valid - safety first
	return nil
}

// checkStale checks if a command timestamp is too old.
func (v *Validator) checkStale(t int64) error {
	if t == 0 {
		return &ValidationError{
			Code:    ErrInvalidTimestamp,
			Message: "timestamp is required",
			Field:   "t",
		}
	}

	age := time.Since(time.UnixMilli(t))
	if age > v.staleThreshold {
		return &ValidationError{
			Code:    ErrStaleCommand,
			Message: fmt.Sprintf("command is stale (age: %v)", age),
			Field:   "t",
		}
	}

	return nil
}
