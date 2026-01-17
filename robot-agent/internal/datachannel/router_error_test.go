package datachannel

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

func TestRouter_NilSenderPanics(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic for nil sender")
		}
	}()
	NewRouter(nil)
}

func TestRouter_SendFailure(t *testing.T) {
	sender := &mockSender{err: errors.New("send failed")}
	r := NewRouter(sender)

	r.RegisterHandler(protocol.TypeDrive, func(data []byte) ([]byte, error) {
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
	if err == nil {
		t.Error("expected error when send fails")
	}
	if !errors.Is(err, ErrSendFailed) {
		t.Errorf("expected ErrSendFailed, got: %v", err)
	}
}

func TestRouter_SendErrorBestEffort(t *testing.T) {
	sender := &mockSender{err: errors.New("send failed")}
	r := NewRouter(sender)

	// No handler registered, should try to send error but fail silently
	data := []byte(`{"type": "drive"}`)
	err := r.HandleMessage(data)

	// Should still return the original error, not the send error
	if !errors.Is(err, ErrNoHandler) {
		t.Errorf("expected ErrNoHandler, got: %v", err)
	}
}
