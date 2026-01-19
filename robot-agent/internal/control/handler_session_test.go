package control

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// mockSessionChecker implements SessionChecker for testing.
type mockSessionChecker struct {
	active bool
}

func (m *mockSessionChecker) IsActive() bool {
	return m.active
}

func TestHandler_SessionRevoked_RejectsCommands(t *testing.T) {
	robot := &mockRobotAPI{}
	session := &mockSessionChecker{active: false}
	h := NewHandler(robot, nil, nil, session, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	// Drive command should be rejected
	driveMsg := &protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    now,
	}
	data, _ := json.Marshal(driveMsg)
	_, err := h.HandleMessage(data)

	if err != ErrSessionRevoked {
		t.Errorf("expected ErrSessionRevoked, got %v", err)
	}

	if len(robot.driveCalls) != 0 {
		t.Error("robot should not be called when session is revoked")
	}
}

func TestHandler_SessionRevoked_RejectsKVMKey(t *testing.T) {
	robot := &mockRobotAPI{}
	session := &mockSessionChecker{active: false}
	h := NewHandler(robot, nil, nil, session, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	keyMsg := &protocol.KVMKeyMessage{
		Type:   protocol.TypeKVMKey,
		Key:    "KeyA",
		Action: "down",
		T:      now,
	}
	data, _ := json.Marshal(keyMsg)
	_, err := h.HandleMessage(data)

	if err != ErrSessionRevoked {
		t.Errorf("expected ErrSessionRevoked, got %v", err)
	}

	if len(robot.keyCalls) != 0 {
		t.Error("robot should not be called when session is revoked")
	}
}

func TestHandler_SessionRevoked_RejectsKVMMouse(t *testing.T) {
	robot := &mockRobotAPI{}
	session := &mockSessionChecker{active: false}
	h := NewHandler(robot, nil, nil, session, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	mouseMsg := &protocol.KVMMouseMessage{
		Type:    protocol.TypeKVMMouse,
		DX:      10,
		DY:      5,
		Buttons: 0,
		T:       now,
	}
	data, _ := json.Marshal(mouseMsg)
	_, err := h.HandleMessage(data)

	if err != ErrSessionRevoked {
		t.Errorf("expected ErrSessionRevoked, got %v", err)
	}

	if len(robot.mouseCalls) != 0 {
		t.Error("robot should not be called when session is revoked")
	}
}

func TestHandler_SessionActive_AllowsCommands(t *testing.T) {
	robot := &mockRobotAPI{}
	session := &mockSessionChecker{active: true}
	h := NewHandler(robot, nil, nil, session, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	driveMsg := &protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    now,
	}
	data, _ := json.Marshal(driveMsg)
	_, err := h.HandleMessage(data)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if len(robot.driveCalls) != 1 {
		t.Error("expected drive to be called when session is active")
	}
}

func TestHandler_SessionRevoked_EStopStillRejected(t *testing.T) {
	// E-Stop is safety-critical, but session check happens first
	// After revocation, no commands should be processed
	robot := &mockRobotAPI{}
	session := &mockSessionChecker{active: false}
	h := NewHandler(robot, nil, nil, session, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	estopMsg := &protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    now,
	}
	data, _ := json.Marshal(estopMsg)
	_, err := h.HandleMessage(data)

	if err != ErrSessionRevoked {
		t.Errorf("expected ErrSessionRevoked for e-stop, got %v", err)
	}
}

func TestHandler_SessionRevoked_MidSession(t *testing.T) {
	robot := &mockRobotAPI{}
	session := &mockSessionChecker{active: true}
	h := NewHandler(robot, nil, nil, session, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	// First command succeeds (session active)
	driveMsg := &protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    now,
	}
	data, _ := json.Marshal(driveMsg)
	_, err := h.HandleMessage(data)
	if err != nil {
		t.Fatalf("first command should succeed: %v", err)
	}

	// Simulate revocation
	session.active = false

	// Next command fails (session revoked)
	_, err = h.HandleMessage(data)
	if err != ErrSessionRevoked {
		t.Errorf("expected ErrSessionRevoked after revocation, got %v", err)
	}
}
