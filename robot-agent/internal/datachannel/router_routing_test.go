package datachannel

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

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
