package control

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// mockSafetyForPing tracks OnValidControl calls for ping testing.
type mockSafetyForPing struct {
	validControlCalls int
}

func (m *mockSafetyForPing) OnValidControl()   { m.validControlCalls++ }
func (m *mockSafetyForPing) OnInvalidCommand() {}
func (m *mockSafetyForPing) OnEStop()          {}

func TestHandler_Ping_ResetsControlLossTimer(t *testing.T) {
	robot := &mockRobotAPI{}
	safety := &mockSafetyForPing{}

	handler := NewHandler(robot, safety, nil, nil, 200*time.Millisecond)

	// Create a ping message
	ping := protocol.PingMessage{
		Type:  protocol.TypePing,
		Seq:   1,
		TMono: time.Now().UnixMilli(),
	}
	data, err := json.Marshal(ping)
	if err != nil {
		t.Fatalf("failed to marshal ping: %v", err)
	}

	// Handle the ping
	ack, err := handler.HandleMessage(data)
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
	if ack != nil {
		t.Errorf("expected nil ack for ping, got: %v", ack)
	}

	// Verify OnValidControl was called (heartbeat resets timer)
	if safety.validControlCalls != 1 {
		t.Errorf("expected 1 OnValidControl call, got %d", safety.validControlCalls)
	}
}

func TestHandler_Ping_MultiplePingsResetTimer(t *testing.T) {
	robot := &mockRobotAPI{}
	safety := &mockSafetyForPing{}

	handler := NewHandler(robot, safety, nil, nil, 200*time.Millisecond)

	// Send multiple pings
	for i := 0; i < 5; i++ {
		ping := protocol.PingMessage{
			Type:  protocol.TypePing,
			Seq:   uint32(i + 1),
			TMono: time.Now().UnixMilli(),
		}
		data, _ := json.Marshal(ping)
		handler.HandleMessage(data)
	}

	// Each ping should call OnValidControl
	if safety.validControlCalls != 5 {
		t.Errorf("expected 5 OnValidControl calls, got %d", safety.validControlCalls)
	}
}

func TestHandler_Ping_NoAckReturned(t *testing.T) {
	robot := &mockRobotAPI{}
	handler := NewHandler(robot, nil, nil, nil, 200*time.Millisecond)

	ping := protocol.PingMessage{
		Type:  protocol.TypePing,
		Seq:   1,
		TMono: time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(ping)

	ack, err := handler.HandleMessage(data)
	if err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
	if ack != nil {
		t.Errorf("ping should not return ack, got: %v", ack)
	}
}

func TestHandler_Ping_SessionRevokedRejectsPing(t *testing.T) {
	robot := &mockRobotAPI{}
	session := &mockSessionChecker{active: false}

	handler := NewHandler(robot, nil, nil, session, 200*time.Millisecond)

	ping := protocol.PingMessage{
		Type:  protocol.TypePing,
		Seq:   1,
		TMono: time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(ping)

	_, err := handler.HandleMessage(data)
	if err != ErrSessionRevoked {
		t.Errorf("expected ErrSessionRevoked, got: %v", err)
	}
}
