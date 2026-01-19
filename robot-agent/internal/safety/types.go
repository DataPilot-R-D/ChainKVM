// Package safety implements the Robot Agent safety subsystem.
package safety

import "time"

// TriggerPriority defines execution priority for safety triggers.
// Lower numeric values indicate higher priority.
type TriggerPriority int

const (
	// PriorityCritical is for human-initiated emergencies (E-Stop).
	PriorityCritical TriggerPriority = 1

	// PrioritySecurity is for security-related triggers (revocation, expiry).
	PrioritySecurity TriggerPriority = 2

	// PriorityOperational is for operational triggers (control loss, invalid cmds).
	PriorityOperational TriggerPriority = 3
)

// Priority returns the priority level for a trigger.
func (t Trigger) Priority() TriggerPriority {
	switch t {
	case TriggerEStop:
		return PriorityCritical
	case TriggerRevoked, TriggerTokenExpired:
		return PrioritySecurity
	default:
		return PriorityOperational
	}
}

// IsRecoverable returns whether the trigger allows recovery without a new session.
// Only TriggerControlLoss is recoverable (transient network issues).
func (t Trigger) IsRecoverable() bool {
	return t == TriggerControlLoss
}

// TransitionResult contains confirmation data for a safe-stop transition.
type TransitionResult struct {
	// Trigger identifies which trigger caused the transition.
	Trigger Trigger

	// Timestamp is when the transition completed.
	Timestamp time.Time

	// Duration is the time taken for the transition.
	Duration time.Duration

	// Error contains any error that occurred during transition.
	Error error
}
