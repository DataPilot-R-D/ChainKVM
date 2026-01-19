// Package control implements control command handling for the Robot Agent.
package control

import "errors"

// Error types for control handling.
var (
	ErrRobotUnavailable = errors.New("robot API unavailable")
	ErrUnknownType      = errors.New("unknown message type")
	ErrInvalidJSON      = errors.New("invalid JSON message")
	ErrScopeNotAllowed  = errors.New("operation not permitted by scope")
	ErrSessionRevoked   = errors.New("session has been revoked")
)

// Scope constants for authorization.
const (
	ScopeControl = "teleop:control"
	ScopeEStop   = "teleop:estop"
)

// RobotAPI defines the interface for robot control operations.
type RobotAPI interface {
	Drive(v, w float64) error
	SendKey(key, action string, modifiers []string) error
	SendMouse(dx, dy, buttons, scroll int) error
	EStop() error
}

// SafetyCallback is called when safety events occur.
type SafetyCallback interface {
	OnValidControl()
	OnInvalidCommand()
	OnEStop()
}

// ScopeChecker checks if a scope is allowed for the current session.
type ScopeChecker interface {
	HasScope(scope string) bool
}

// SessionChecker checks if the session is still active.
type SessionChecker interface {
	IsActive() bool
}
