// Package control implements control command handling for the Robot Agent.
package control

import (
	"encoding/json"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// Handler processes control messages and dispatches to robot API.
type Handler struct {
	robot     RobotAPI
	safety    SafetyCallback
	scopes    ScopeChecker
	session   SessionChecker
	validator *Validator
}

// NewHandler creates a new control message handler.
func NewHandler(
	robot RobotAPI,
	safety SafetyCallback,
	scopes ScopeChecker,
	session SessionChecker,
	staleThreshold time.Duration,
) *Handler {
	return &Handler{
		robot:     robot,
		safety:    safety,
		scopes:    scopes,
		session:   session,
		validator: NewValidator(staleThreshold),
	}
}

// HandleMessage processes a raw JSON message and dispatches to the handler.
func (h *Handler) HandleMessage(data []byte) (*protocol.AckMessage, error) {
	var base protocol.BaseMessage
	if err := json.Unmarshal(data, &base); err != nil {
		h.notifyInvalid()
		return nil, ErrInvalidJSON
	}

	// Check if session is still active (reject commands from revoked sessions)
	if !h.isSessionActive() {
		return nil, ErrSessionRevoked
	}

	var err error
	var refT int64

	switch base.Type {
	case protocol.TypeDrive:
		var msg protocol.DriveMessage
		if err = json.Unmarshal(data, &msg); err != nil {
			h.notifyInvalid()
			return nil, ErrInvalidJSON
		}
		refT = msg.T
		err = h.HandleDrive(&msg)

	case protocol.TypeKVMKey:
		var msg protocol.KVMKeyMessage
		if err = json.Unmarshal(data, &msg); err != nil {
			h.notifyInvalid()
			return nil, ErrInvalidJSON
		}
		refT = msg.T
		err = h.HandleKVMKey(&msg)

	case protocol.TypeKVMMouse:
		var msg protocol.KVMMouseMessage
		if err = json.Unmarshal(data, &msg); err != nil {
			h.notifyInvalid()
			return nil, ErrInvalidJSON
		}
		refT = msg.T
		err = h.HandleKVMMouse(&msg)

	case protocol.TypeEStop:
		var msg protocol.EStopMessage
		if err = json.Unmarshal(data, &msg); err != nil {
			h.notifyInvalid()
			return nil, ErrInvalidJSON
		}
		refT = msg.T
		err = h.HandleEStop(&msg)

	case protocol.TypePing:
		// Ping acts as heartbeat - resets control loss timer
		h.notifyValid()
		return nil, nil

	default:
		h.notifyInvalid()
		return nil, ErrUnknownType
	}

	if err != nil {
		return nil, err
	}

	return &protocol.AckMessage{
		Type:    protocol.TypeAck,
		RefType: base.Type,
		RefT:    refT,
	}, nil
}

// HandleDrive processes a drive command.
func (h *Handler) HandleDrive(msg *protocol.DriveMessage) error {
	if !h.hasScope(ScopeControl) {
		return ErrScopeNotAllowed
	}

	if err := h.validator.ValidateDrive(msg); err != nil {
		h.notifyInvalid()
		return err
	}

	if err := h.robot.Drive(msg.V, msg.W); err != nil {
		return err
	}

	h.notifyValid()
	return nil
}

// HandleKVMKey processes a keyboard input command.
func (h *Handler) HandleKVMKey(msg *protocol.KVMKeyMessage) error {
	if !h.hasScope(ScopeControl) {
		return ErrScopeNotAllowed
	}

	if err := h.validator.ValidateKVMKey(msg); err != nil {
		h.notifyInvalid()
		return err
	}

	if err := h.robot.SendKey(msg.Key, msg.Action, msg.Modifiers); err != nil {
		return err
	}

	h.notifyValid()
	return nil
}

// HandleKVMMouse processes a mouse input command.
func (h *Handler) HandleKVMMouse(msg *protocol.KVMMouseMessage) error {
	if !h.hasScope(ScopeControl) {
		return ErrScopeNotAllowed
	}

	if err := h.validator.ValidateKVMMouse(msg); err != nil {
		h.notifyInvalid()
		return err
	}

	if err := h.robot.SendMouse(msg.DX, msg.DY, msg.Buttons, msg.Scroll); err != nil {
		return err
	}

	h.notifyValid()
	return nil
}

// HandleEStop processes an emergency stop command.
func (h *Handler) HandleEStop(msg *protocol.EStopMessage) error {
	// E-Stop validation is minimal for safety
	if err := h.validator.ValidateEStop(msg); err != nil {
		return err
	}

	// Notify safety subsystem first
	if h.safety != nil {
		h.safety.OnEStop()
	}

	// Execute e-stop
	return h.robot.EStop()
}

// notifyValid notifies safety of a valid control message.
func (h *Handler) notifyValid() {
	if h.safety != nil {
		h.safety.OnValidControl()
	}
}

// notifyInvalid notifies safety of an invalid command.
func (h *Handler) notifyInvalid() {
	if h.safety != nil {
		h.safety.OnInvalidCommand()
	}
}

// hasScope checks if the session allows the given scope.
func (h *Handler) hasScope(scope string) bool {
	if h.scopes == nil {
		return true // No scope checker = allow all (for testing)
	}
	return h.scopes.HasScope(scope)
}

// isSessionActive checks if the session is still active.
func (h *Handler) isSessionActive() bool {
	if h.session == nil {
		return true // No session checker = allow all (for testing)
	}
	return h.session.IsActive()
}
