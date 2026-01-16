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

func TestRouter_RoutesDriveToHandler(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	var receivedData []byte
	r.RegisterHandler(protocol.TypeDrive, func(data []byte) ([]byte, error) {
		receivedData = data
		return json.Marshal(protocol.AckMessage{
			Type:    protocol.TypeAck,
			RefType: protocol.TypeDrive,
		})
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
	if receivedData == nil {
		t.Error("handler did not receive data")
	}
}

func TestRouter_RoutesKVMKeyToHandler(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	called := false
	r.RegisterHandler(protocol.TypeKVMKey, func(data []byte) ([]byte, error) {
		called = true
		return nil, nil
	})

	msg := protocol.KVMKeyMessage{
		Type:   protocol.TypeKVMKey,
		Key:    "KeyA",
		Action: "down",
		T:      time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(msg)

	err := r.HandleMessage(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Error("KVM key handler was not called")
	}
}

func TestRouter_RoutesKVMMouseToHandler(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	called := false
	r.RegisterHandler(protocol.TypeKVMMouse, func(data []byte) ([]byte, error) {
		called = true
		return nil, nil
	})

	msg := protocol.KVMMouseMessage{
		Type:    protocol.TypeKVMMouse,
		DX:      10,
		DY:      -5,
		Buttons: 1,
		T:       time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(msg)

	err := r.HandleMessage(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Error("KVM mouse handler was not called")
	}
}

func TestRouter_RoutesEStopToHandler(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	called := false
	r.RegisterHandler(protocol.TypeEStop, func(data []byte) ([]byte, error) {
		called = true
		return nil, nil
	})

	msg := protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(msg)

	err := r.HandleMessage(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Error("E-Stop handler was not called")
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

	// Should send error response
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

	// Should send error response
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

	// Check response was sent
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

	// Should send error response
	msgs := sender.getMessages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 error message sent, got %d", len(msgs))
	}
}

func TestRouter_NoHandlerRegistered(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	// No handler registered for TypeDrive
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

func TestRouter_PingHandler(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	var receivedSeq uint32
	r.RegisterHandler(protocol.TypePing, func(data []byte) ([]byte, error) {
		var ping protocol.PingMessage
		if err := json.Unmarshal(data, &ping); err != nil {
			return nil, err
		}
		receivedSeq = ping.Seq
		return json.Marshal(protocol.PongMessage{
			Type:  protocol.TypePong,
			Seq:   ping.Seq,
			TMono: ping.TMono,
			TRecv: time.Now().UnixNano(),
		})
	})

	msg := protocol.PingMessage{
		Type:  protocol.TypePing,
		Seq:   42,
		TMono: time.Now().UnixNano(),
	}
	data, _ := json.Marshal(msg)

	err := r.HandleMessage(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if receivedSeq != 42 {
		t.Errorf("expected seq=42, got %d", receivedSeq)
	}

	// Check pong response
	msgs := sender.getMessages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 pong response, got %d", len(msgs))
	}

	var pong protocol.PongMessage
	if err := json.Unmarshal(msgs[0], &pong); err != nil {
		t.Fatalf("failed to unmarshal pong: %v", err)
	}
	if pong.Seq != 42 {
		t.Errorf("expected pong seq=42, got %d", pong.Seq)
	}
}

func TestRouter_HighMessageRate(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	var count int
	var mu sync.Mutex
	r.RegisterHandler(protocol.TypeDrive, func(data []byte) ([]byte, error) {
		mu.Lock()
		count++
		mu.Unlock()
		return nil, nil
	})

	// Send 1000 messages
	for i := range 1000 {
		msg := protocol.DriveMessage{
			Type: protocol.TypeDrive,
			V:    float64(i) / 1000,
			W:    0,
			T:    time.Now().UnixMilli(),
		}
		data, _ := json.Marshal(msg)
		err := r.HandleMessage(data)
		if err != nil {
			t.Fatalf("error at message %d: %v", i, err)
		}
	}

	mu.Lock()
	if count != 1000 {
		t.Errorf("expected 1000 messages processed, got %d", count)
	}
	mu.Unlock()
}

func TestRouter_ConcurrentHandlers(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	var driveCount, keyCount int
	var mu sync.Mutex

	r.RegisterHandler(protocol.TypeDrive, func(data []byte) ([]byte, error) {
		mu.Lock()
		driveCount++
		mu.Unlock()
		return nil, nil
	})

	r.RegisterHandler(protocol.TypeKVMKey, func(data []byte) ([]byte, error) {
		mu.Lock()
		keyCount++
		mu.Unlock()
		return nil, nil
	})

	var wg sync.WaitGroup
	for range 100 {
		wg.Add(2)
		go func() {
			defer wg.Done()
			msg := protocol.DriveMessage{
				Type: protocol.TypeDrive,
				V:    0.5,
				W:    0.3,
				T:    time.Now().UnixMilli(),
			}
			data, _ := json.Marshal(msg)
			r.HandleMessage(data)
		}()
		go func() {
			defer wg.Done()
			msg := protocol.KVMKeyMessage{
				Type:   protocol.TypeKVMKey,
				Key:    "KeyA",
				Action: "down",
				T:      time.Now().UnixMilli(),
			}
			data, _ := json.Marshal(msg)
			r.HandleMessage(data)
		}()
	}
	wg.Wait()

	mu.Lock()
	defer mu.Unlock()
	if driveCount != 100 {
		t.Errorf("expected 100 drive messages, got %d", driveCount)
	}
	if keyCount != 100 {
		t.Errorf("expected 100 key messages, got %d", keyCount)
	}
}

func TestRouter_HandlerNoResponse(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	r.RegisterHandler(protocol.TypeDrive, func(data []byte) ([]byte, error) {
		return nil, nil // No response
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

	// No response should be sent
	msgs := sender.getMessages()
	if len(msgs) != 0 {
		t.Errorf("expected no response sent, got %d", len(msgs))
	}
}
