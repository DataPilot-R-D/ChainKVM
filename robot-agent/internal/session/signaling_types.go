// Package session provides signaling types for Gateway communication.
package session

import (
	"encoding/json"
	"errors"
)

// SignalType identifies signaling message types.
type SignalType string

const (
	SignalJoin    SignalType = "join"
	SignalOffer   SignalType = "offer"
	SignalAnswer  SignalType = "answer"
	SignalICE     SignalType = "ice"
	SignalBye     SignalType = "bye"
	SignalError   SignalType = "error"
	SignalRevoked SignalType = "revoked"
)

// SignalMessage is the signaling protocol message.
type SignalMessage struct {
	Type      SignalType      `json:"type"`
	RobotID   string          `json:"robot_id,omitempty"`
	SessionID string          `json:"session_id,omitempty"`
	Token     string          `json:"token,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Error     string          `json:"error,omitempty"`
	Reason    string          `json:"reason,omitempty"`
}

// Error definitions for signaling.
var (
	ErrNotConnected = errors.New("not connected to gateway")
	ErrConnClosed   = errors.New("connection closed")
)

// SignalingHandler handles incoming signaling messages.
type SignalingHandler interface {
	OnOffer(sessionID, token string, sdp []byte)
	OnAnswer(sessionID string, sdp []byte)
	OnICE(sessionID string, candidate []byte)
	OnBye(sessionID string)
	OnRevoked(sessionID, reason string)
}
