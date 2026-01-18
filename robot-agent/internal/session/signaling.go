// Package session provides signaling client for Gateway communication.
package session

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// SignalType identifies signaling message types.
type SignalType string

const (
	SignalJoin   SignalType = "join"
	SignalOffer  SignalType = "offer"
	SignalAnswer SignalType = "answer"
	SignalICE    SignalType = "ice"
	SignalBye    SignalType = "bye"
	SignalError  SignalType = "error"
)

// SignalMessage is the signaling protocol message.
type SignalMessage struct {
	Type      SignalType      `json:"type"`
	RobotID   string          `json:"robot_id,omitempty"`
	SessionID string          `json:"session_id,omitempty"`
	Token     string          `json:"token,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Error     string          `json:"error,omitempty"`
}

// Error definitions.
var (
	ErrNotConnected = errors.New("not connected to gateway")
	ErrConnClosed   = errors.New("connection closed")
)

// SignalingHandler handles incoming signaling messages.
type SignalingHandler interface {
	OnOffer(sessionID string, sdp []byte)
	OnAnswer(sessionID string, sdp []byte)
	OnICE(sessionID string, candidate []byte)
	OnBye(sessionID string)
}

// SignalingClient manages WebSocket connection to Gateway.
type SignalingClient struct {
	mu      sync.Mutex
	url     string
	robotID string
	logger  *zap.Logger

	conn    *websocket.Conn
	handler SignalingHandler
	stopCh  chan struct{}
	done    chan struct{}
}

// NewSignalingClient creates a new signaling client.
func NewSignalingClient(url, robotID string, logger *zap.Logger) *SignalingClient {
	return &SignalingClient{
		url:     url,
		robotID: robotID,
		logger:  logger,
		stopCh:  make(chan struct{}),
		done:    make(chan struct{}),
	}
}

// SetHandler sets the signaling message handler.
func (c *SignalingClient) SetHandler(h SignalingHandler) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handler = h
}

// Connect establishes WebSocket connection with retry.
func (c *SignalingClient) Connect(ctx context.Context) error {
	c.mu.Lock()
	if c.conn != nil {
		c.mu.Unlock()
		return nil
	}
	c.mu.Unlock()

	return c.connectWithRetry(ctx)
}

func (c *SignalingClient) connectWithRetry(ctx context.Context) error {
	backoff := 1 * time.Second
	maxBackoff := 30 * time.Second

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-c.stopCh:
			return ErrConnClosed
		default:
		}

		c.logger.Info("connecting to gateway", zap.String("url", c.url))

		header := http.Header{}
		conn, _, err := websocket.DefaultDialer.DialContext(ctx, c.url, header)
		if err != nil {
			c.logger.Warn("connection failed, retrying",
				zap.Error(err),
				zap.Duration("backoff", backoff))

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-c.stopCh:
				return ErrConnClosed
			case <-time.After(backoff):
			}

			backoff = min(backoff*2, maxBackoff)
			continue
		}

		c.mu.Lock()
		c.conn = conn
		c.mu.Unlock()

		c.logger.Info("connected to gateway")

		// Send join message
		if err := c.sendJoin(); err != nil {
			c.logger.Error("failed to send join", zap.Error(err))
			conn.Close()
			continue
		}

		// Start read loop
		go c.readLoop()

		return nil
	}
}

func (c *SignalingClient) sendJoin() error {
	msg := SignalMessage{
		Type:    SignalJoin,
		RobotID: c.robotID,
	}
	return c.send(msg)
}

func (c *SignalingClient) send(msg SignalMessage) error {
	c.mu.Lock()
	conn := c.conn
	c.mu.Unlock()

	if conn == nil {
		return ErrNotConnected
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return conn.WriteMessage(websocket.TextMessage, data)
}

func (c *SignalingClient) readLoop() {
	defer func() {
		close(c.done)
	}()

	c.mu.Lock()
	conn := c.conn
	c.mu.Unlock()

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			c.logger.Warn("read error", zap.Error(err))
			return
		}

		var msg SignalMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			c.logger.Warn("invalid message", zap.Error(err))
			continue
		}

		c.handleMessage(msg)
	}
}

func (c *SignalingClient) handleMessage(msg SignalMessage) {
	c.mu.Lock()
	handler := c.handler
	c.mu.Unlock()

	if handler == nil {
		c.logger.Warn("no handler for message", zap.String("type", string(msg.Type)))
		return
	}

	switch msg.Type {
	case SignalOffer:
		handler.OnOffer(msg.SessionID, msg.Payload)
	case SignalAnswer:
		handler.OnAnswer(msg.SessionID, msg.Payload)
	case SignalICE:
		handler.OnICE(msg.SessionID, msg.Payload)
	case SignalBye:
		handler.OnBye(msg.SessionID)
	case SignalError:
		c.logger.Error("signaling error", zap.String("error", msg.Error))
	}
}

// SendAnswer sends an SDP answer to the gateway.
func (c *SignalingClient) SendAnswer(sessionID string, sdp []byte) error {
	return c.send(SignalMessage{
		Type:      SignalAnswer,
		SessionID: sessionID,
		Payload:   sdp,
	})
}

// SendICE sends an ICE candidate to the gateway.
func (c *SignalingClient) SendICE(sessionID string, candidate []byte) error {
	return c.send(SignalMessage{
		Type:      SignalICE,
		SessionID: sessionID,
		Payload:   candidate,
	})
}

// Close closes the signaling connection.
func (c *SignalingClient) Close() error {
	close(c.stopCh)

	c.mu.Lock()
	conn := c.conn
	c.conn = nil
	c.mu.Unlock()

	if conn != nil {
		return conn.Close()
	}
	return nil
}

// Done returns a channel that closes when the connection ends.
func (c *SignalingClient) Done() <-chan struct{} {
	return c.done
}
