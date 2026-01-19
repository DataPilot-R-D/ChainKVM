package safety

import (
	"testing"
	"time"
)

func TestTriggerPriority(t *testing.T) {
	tests := []struct {
		trigger  Trigger
		expected TriggerPriority
	}{
		{TriggerEStop, PriorityCritical},
		{TriggerRevoked, PrioritySecurity},
		{TriggerTokenExpired, PrioritySecurity},
		{TriggerControlLoss, PriorityOperational},
		{TriggerInvalidCmds, PriorityOperational},
	}

	for _, tt := range tests {
		t.Run(string(tt.trigger), func(t *testing.T) {
			got := tt.trigger.Priority()
			if got != tt.expected {
				t.Errorf("Priority() = %d, want %d", got, tt.expected)
			}
		})
	}
}

func TestTriggerPriority_CriticalHighest(t *testing.T) {
	if PriorityCritical >= PrioritySecurity {
		t.Error("Critical priority should be numerically lower (higher priority)")
	}
	if PrioritySecurity >= PriorityOperational {
		t.Error("Security priority should be numerically lower than operational")
	}
}

func TestTriggerIsRecoverable(t *testing.T) {
	tests := []struct {
		trigger     Trigger
		recoverable bool
	}{
		{TriggerEStop, false},
		{TriggerRevoked, false},
		{TriggerTokenExpired, false},
		{TriggerControlLoss, true},
		{TriggerInvalidCmds, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.trigger), func(t *testing.T) {
			got := tt.trigger.IsRecoverable()
			if got != tt.recoverable {
				t.Errorf("IsRecoverable() = %v, want %v", got, tt.recoverable)
			}
		})
	}
}

func TestTransitionResult_Fields(t *testing.T) {
	now := time.Now()
	result := TransitionResult{
		Trigger:   TriggerEStop,
		Timestamp: now,
		Duration:  50 * time.Millisecond,
		Error:     nil,
	}

	if result.Trigger != TriggerEStop {
		t.Error("Trigger field not preserved")
	}
	if result.Timestamp != now {
		t.Error("Timestamp field not preserved")
	}
	if result.Duration != 50*time.Millisecond {
		t.Error("Duration field not preserved")
	}
	if result.Error != nil {
		t.Error("Error field should be nil")
	}
}

func TestTransitionResult_WithError(t *testing.T) {
	testErr := errHardwareFailed
	result := TransitionResult{
		Trigger: TriggerEStop,
		Error:   testErr,
	}

	if result.Trigger != TriggerEStop {
		t.Error("Trigger field not preserved")
	}
	if result.Error != testErr {
		t.Error("Error field not preserved")
	}
}

// errHardwareFailed is a test error for hardware failures.
var errHardwareFailed = &hardwareError{msg: "hardware stop failed"}

type hardwareError struct {
	msg string
}

func (e *hardwareError) Error() string { return e.msg }
