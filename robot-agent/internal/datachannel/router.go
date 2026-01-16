// Package datachannel provides WebRTC DataChannel message routing.
package datachannel

import (
	"encoding/json"
	"errors"
	"sync"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// Error types for router operations.
var (
	ErrInvalidJSON = errors.New("invalid JSON message")
	ErrUnknownType = errors.New("unknown message type")
	ErrNoHandler   = errors.New("no handler registered for message type")
)

// MessageHandler processes a message and returns an optional response.
type MessageHandler func(data []byte) (response []byte, err error)

// ResponseSender sends responses back via DataChannel.
type ResponseSender interface {
	Send(data []byte) error
}

// Router routes DataChannel messages to registered handlers.
type Router struct {
	mu       sync.RWMutex
	handlers map[protocol.MessageType]MessageHandler
	sender   ResponseSender
}

// NewRouter creates a new message router with the given response sender.
func NewRouter(sender ResponseSender) *Router {
	return &Router{
		handlers: make(map[protocol.MessageType]MessageHandler),
		sender:   sender,
	}
}

// RegisterHandler registers a handler for a specific message type.
func (r *Router) RegisterHandler(msgType protocol.MessageType, handler MessageHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[msgType] = handler
}

// HandleMessage processes a raw message and routes to the appropriate handler.
func (r *Router) HandleMessage(data []byte) error {
	var base protocol.BaseMessage
	if err := json.Unmarshal(data, &base); err != nil {
		r.sendError(protocol.ErrInvalidMessage, "failed to parse message", "", 0)
		return ErrInvalidJSON
	}

	r.mu.RLock()
	handler, ok := r.handlers[base.Type]
	r.mu.RUnlock()

	if !ok {
		if !isKnownType(base.Type) {
			r.sendError(protocol.ErrUnknownType, "unknown message type", base.Type, 0)
			return ErrUnknownType
		}
		r.sendError(protocol.ErrUnknownType, "no handler for message type", base.Type, 0)
		return ErrNoHandler
	}

	response, err := handler(data)
	if err != nil {
		r.sendError(protocol.ErrInvalidMessage, err.Error(), base.Type, 0)
		return err
	}

	if response != nil {
		r.sender.Send(response)
	}

	return nil
}

// sendError sends an error message to the peer.
func (r *Router) sendError(code, reason string, refType protocol.MessageType, refT int64) {
	errMsg := protocol.ErrorMessage{
		Type:    protocol.TypeError,
		Code:    code,
		Reason:  reason,
		RefType: refType,
		RefT:    refT,
	}
	data, err := json.Marshal(errMsg)
	if err != nil {
		return
	}
	r.sender.Send(data)
}

// isKnownType checks if a message type is defined in the protocol.
func isKnownType(t protocol.MessageType) bool {
	switch t {
	case protocol.TypeAuth, protocol.TypeAuthOK, protocol.TypeAuthErr,
		protocol.TypeDrive, protocol.TypeKVMKey, protocol.TypeKVMMouse, protocol.TypeEStop,
		protocol.TypePing, protocol.TypePong,
		protocol.TypeAck, protocol.TypeError, protocol.TypeState:
		return true
	default:
		return false
	}
}
