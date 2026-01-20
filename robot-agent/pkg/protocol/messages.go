// Package protocol defines DataChannel message types.
package protocol

// MessageType identifies the type of DataChannel message.
type MessageType string

const (
	// Authentication
	TypeAuth    MessageType = "auth"
	TypeAuthOK  MessageType = "auth_ok"
	TypeAuthErr MessageType = "auth_err"

	// Control
	TypeDrive    MessageType = "drive"
	TypeKVMKey   MessageType = "kvm_key"
	TypeKVMMouse MessageType = "kvm_mouse"
	TypeEStop    MessageType = "e_stop"

	// Measurement
	TypePing           MessageType = "ping"
	TypePong           MessageType = "pong"
	TypeFrameTimestamp MessageType = "frame_timestamp"

	// Response
	TypeAck   MessageType = "ack"
	TypeError MessageType = "error"
	TypeState MessageType = "state"
)

// BaseMessage is the common structure for all messages.
type BaseMessage struct {
	Type MessageType `json:"type"`
}

// AuthMessage is sent by console to authenticate.
type AuthMessage struct {
	Type      MessageType `json:"type"`
	SessionID string      `json:"session_id"`
	Token     string      `json:"token"`
}

// AuthOKMessage confirms successful authentication.
type AuthOKMessage struct {
	Type      MessageType `json:"type"`
	SessionID string      `json:"session_id"`
	RobotID   string      `json:"robot_id"`
	Scope     []string    `json:"scope"`
	ExpiresAt int64       `json:"expires_at"`
}

// AuthErrMessage indicates authentication failure.
type AuthErrMessage struct {
	Type   MessageType `json:"type"`
	Code   string      `json:"code"`
	Reason string      `json:"reason"`
}

// Auth error codes.
const (
	ErrInvalidToken      = "INVALID_TOKEN"
	ErrTokenExpired      = "TOKEN_EXPIRED"
	ErrWrongAudience     = "WRONG_AUDIENCE"
	ErrSessionMismatch   = "SESSION_MISMATCH"
	ErrInsufficientScope = "INSUFFICIENT_SCOPE"
)

// DriveMessage commands mobile base velocity.
type DriveMessage struct {
	Type MessageType `json:"type"`
	V    float64     `json:"v"` // Linear velocity [-1, 1]
	W    float64     `json:"w"` // Angular velocity [-1, 1]
	T    int64       `json:"t"` // Timestamp (ms)
}

// KVMKeyMessage sends keyboard input.
type KVMKeyMessage struct {
	Type      MessageType `json:"type"`
	Key       string      `json:"key"`
	Action    string      `json:"action"` // "down" or "up"
	Modifiers []string    `json:"modifiers,omitempty"`
	T         int64       `json:"t"`
}

// KVMMouseMessage sends mouse input.
type KVMMouseMessage struct {
	Type    MessageType `json:"type"`
	DX      int         `json:"dx"`
	DY      int         `json:"dy"`
	Buttons int         `json:"buttons"` // Bitmask
	Scroll  int         `json:"scroll,omitempty"`
	T       int64       `json:"t"`
}

// EStopMessage triggers emergency stop.
type EStopMessage struct {
	Type MessageType `json:"type"`
	T    int64       `json:"t"`
}

// PingMessage measures RTT.
type PingMessage struct {
	Type  MessageType `json:"type"`
	Seq   uint32      `json:"seq"`
	TMono int64       `json:"t_mono"`
}

// PongMessage responds to ping.
type PongMessage struct {
	Type  MessageType `json:"type"`
	Seq   uint32      `json:"seq"`
	TMono int64       `json:"t_mono"`
	TRecv int64       `json:"t_recv"`
}

// FrameTimestampMessage sends video frame timestamp for latency measurement.
type FrameTimestampMessage struct {
	Type           MessageType `json:"type"`
	Timestamp      int64       `json:"timestamp"`        // Unix milliseconds when frame captured
	FrameID        uint64      `json:"frame_id"`         // Monotonic frame counter
	SequenceNumber uint64      `json:"sequence_number"`  // Message sequence for loss detection
}

// AckMessage acknowledges a command.
type AckMessage struct {
	Type    MessageType `json:"type"`
	RefType MessageType `json:"ref_type"`
	RefT    int64       `json:"ref_t"`
}

// ErrorMessage indicates command failure.
type ErrorMessage struct {
	Type    MessageType `json:"type"`
	Code    string      `json:"code"`
	Reason  string      `json:"reason"`
	RefType MessageType `json:"ref_type,omitempty"`
	RefT    int64       `json:"ref_t,omitempty"`
}

// Error codes.
const (
	ErrInvalidMessage  = "INVALID_MESSAGE"
	ErrUnknownType     = "UNKNOWN_TYPE"
	ErrStaleCommand    = "STALE_COMMAND"
	ErrRateLimited     = "RATE_LIMITED"
	ErrUnauthorized    = "UNAUTHORIZED"
	ErrSafeStopped     = "SAFE_STOPPED"
	ErrSessionRevoked  = "SESSION_REVOKED"
)

// StateMessage reports robot state.
type StateMessage struct {
	Type         MessageType `json:"type"`
	RobotState   string      `json:"robot_state"`
	SessionState string      `json:"session_state"`
	T            int64       `json:"t"`
}

// Robot states.
const (
	RobotStateIdle           = "idle"
	RobotStateActive         = "active"
	RobotStateSafeStop       = "safe_stop"
	RobotStateSafeStopFailed = "safe_stop_failed" // Hardware stop failed - robot may still be moving
)

// Scopes for authorization.
const (
	ScopeView    = "teleop:view"
	ScopeControl = "teleop:control"
	ScopeEStop   = "teleop:estop"
)
