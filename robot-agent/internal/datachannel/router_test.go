package datachannel

import (
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// mockSender captures sent messages for testing.
type mockSender struct {
	mu       sync.Mutex
	messages [][]byte
	err      error
}

func (m *mockSender) Send(data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.err != nil {
		return m.err
	}
	m.messages = append(m.messages, data)
	return nil
}

func (m *mockSender) getMessages() [][]byte {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.messages
}

func TestRouter_RegisterHandler(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	called := false
	handler := func(data []byte) ([]byte, error) {
		called = true
		return nil, nil
	}

	r.RegisterHandler(protocol.TypeDrive, handler)

	msg := protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(msg)

	err := r.HandleMessage(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Error("handler was not called")
	}
}

func TestRouter_UnknownMessageType(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	data := []byte(`{"type": "unknown_type"}`)
	err := r.HandleMessage(data)

	if err == nil {
		t.Error("expected error for unknown type")
	}
	if !errors.Is(err, ErrUnknownType) {
		t.Errorf("expected ErrUnknownType, got: %v", err)
	}

	msgs := sender.getMessages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 error message sent, got %d", len(msgs))
	}

	var errMsg protocol.ErrorMessage
	if err := json.Unmarshal(msgs[0], &errMsg); err != nil {
		t.Fatalf("failed to unmarshal error message: %v", err)
	}
	if errMsg.Code != protocol.ErrUnknownType {
		t.Errorf("expected code %s, got %s", protocol.ErrUnknownType, errMsg.Code)
	}
}

func TestRouter_InvalidJSON(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	err := r.HandleMessage([]byte("not json"))
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
	if !errors.Is(err, ErrInvalidJSON) {
		t.Errorf("expected ErrInvalidJSON, got: %v", err)
	}

	msgs := sender.getMessages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 error message sent, got %d", len(msgs))
	}
}

func TestRouter_HandlerReturnsResponse(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	ackResponse := protocol.AckMessage{
		Type:    protocol.TypeAck,
		RefType: protocol.TypeDrive,
		RefT:    12345,
	}

	r.RegisterHandler(protocol.TypeDrive, func(data []byte) ([]byte, error) {
		return json.Marshal(ackResponse)
	})

	msg := protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    12345,
	}
	data, _ := json.Marshal(msg)

	err := r.HandleMessage(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msgs := sender.getMessages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 response sent, got %d", len(msgs))
	}

	var ack protocol.AckMessage
	if err := json.Unmarshal(msgs[0], &ack); err != nil {
		t.Fatalf("failed to unmarshal ack: %v", err)
	}
	if ack.RefT != 12345 {
		t.Errorf("expected RefT=12345, got %d", ack.RefT)
	}
}

func TestRouter_HandlerReturnsError(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	handlerErr := errors.New("handler failed")
	r.RegisterHandler(protocol.TypeDrive, func(data []byte) ([]byte, error) {
		return nil, handlerErr
	})

	msg := protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(msg)

	err := r.HandleMessage(data)
	if err == nil {
		t.Error("expected error from handler")
	}

	msgs := sender.getMessages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 error message sent, got %d", len(msgs))
	}
}

func TestRouter_NoHandlerRegistered(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	msg := protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(msg)

	err := r.HandleMessage(data)
	if err == nil {
		t.Error("expected error for no handler")
	}
	if !errors.Is(err, ErrNoHandler) {
		t.Errorf("expected ErrNoHandler, got: %v", err)
	}
}

func TestRouter_HandlerNoResponse(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	r.RegisterHandler(protocol.TypeDrive, func(data []byte) ([]byte, error) {
		return nil, nil
	})

	msg := protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(msg)

	err := r.HandleMessage(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msgs := sender.getMessages()
	if len(msgs) != 0 {
		t.Errorf("expected no response sent, got %d", len(msgs))
	}
}
