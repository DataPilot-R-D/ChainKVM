package control

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// mockRobotAPI captures commands for testing.
type mockRobotAPI struct {
	mu          sync.Mutex
	driveCalls  []DriveCommand
	keyCalls    []KeyCommand
	mouseCalls  []MouseCommand
	estopCalls  int
	shouldError bool
}

type DriveCommand struct {
	V, W float64
}

type KeyCommand struct {
	Key       string
	Action    string
	Modifiers []string
}

type MouseCommand struct {
	DX, DY  int
	Buttons int
	Scroll  int
}

func (m *mockRobotAPI) Drive(v, w float64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.shouldError {
		return ErrRobotUnavailable
	}
	m.driveCalls = append(m.driveCalls, DriveCommand{V: v, W: w})
	return nil
}

func (m *mockRobotAPI) SendKey(key, action string, modifiers []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.shouldError {
		return ErrRobotUnavailable
	}
	m.keyCalls = append(m.keyCalls, KeyCommand{Key: key, Action: action, Modifiers: modifiers})
	return nil
}

func (m *mockRobotAPI) SendMouse(dx, dy, buttons, scroll int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.shouldError {
		return ErrRobotUnavailable
	}
	m.mouseCalls = append(m.mouseCalls, MouseCommand{DX: dx, DY: dy, Buttons: buttons, Scroll: scroll})
	return nil
}

func (m *mockRobotAPI) EStop() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.estopCalls++
	return nil // E-stop always succeeds
}

func TestHandler_HandleDrive(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    now,
	}

	err := h.HandleDrive(msg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(robot.driveCalls) != 1 {
		t.Fatalf("expected 1 drive call, got %d", len(robot.driveCalls))
	}

	if robot.driveCalls[0].V != 0.5 || robot.driveCalls[0].W != 0.3 {
		t.Errorf("expected v=0.5, w=0.3, got v=%f, w=%f",
			robot.driveCalls[0].V, robot.driveCalls[0].W)
	}
}

func TestHandler_HandleKVMKey(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.KVMKeyMessage{
		Type:      protocol.TypeKVMKey,
		Key:       "KeyA",
		Action:    "down",
		Modifiers: []string{"ctrl"},
		T:         now,
	}

	err := h.HandleKVMKey(msg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(robot.keyCalls) != 1 {
		t.Fatalf("expected 1 key call, got %d", len(robot.keyCalls))
	}

	if robot.keyCalls[0].Key != "KeyA" {
		t.Errorf("expected key=KeyA, got %s", robot.keyCalls[0].Key)
	}
}

func TestHandler_HandleKVMMouse(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.KVMMouseMessage{
		Type:    protocol.TypeKVMMouse,
		DX:      10,
		DY:      -5,
		Buttons: 1,
		Scroll:  0,
		T:       now,
	}

	err := h.HandleKVMMouse(msg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(robot.mouseCalls) != 1 {
		t.Fatalf("expected 1 mouse call, got %d", len(robot.mouseCalls))
	}

	if robot.mouseCalls[0].DX != 10 || robot.mouseCalls[0].DY != -5 {
		t.Errorf("expected dx=10, dy=-5, got dx=%d, dy=%d",
			robot.mouseCalls[0].DX, robot.mouseCalls[0].DY)
	}
}

func TestHandler_HandleEStop(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    now,
	}

	err := h.HandleEStop(msg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if robot.estopCalls != 1 {
		t.Errorf("expected 1 e-stop call, got %d", robot.estopCalls)
	}
}

func TestHandler_HandleMessage_Dispatch(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	tests := []struct {
		name     string
		msgType  protocol.MessageType
		msg      interface{}
		checkFn  func()
	}{
		{
			name:    "drive dispatch",
			msgType: protocol.TypeDrive,
			msg:     &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.1, W: 0.2, T: now},
			checkFn: func() {
				if len(robot.driveCalls) == 0 {
					t.Error("drive not called")
				}
			},
		},
		{
			name:    "kvm_key dispatch",
			msgType: protocol.TypeKVMKey,
			msg:     &protocol.KVMKeyMessage{Type: protocol.TypeKVMKey, Key: "KeyB", Action: "down", T: now},
			checkFn: func() {
				if len(robot.keyCalls) == 0 {
					t.Error("key not called")
				}
			},
		},
		{
			name:    "kvm_mouse dispatch",
			msgType: protocol.TypeKVMMouse,
			msg:     &protocol.KVMMouseMessage{Type: protocol.TypeKVMMouse, DX: 1, DY: 1, T: now},
			checkFn: func() {
				if len(robot.mouseCalls) == 0 {
					t.Error("mouse not called")
				}
			},
		},
		{
			name:    "e_stop dispatch",
			msgType: protocol.TypeEStop,
			msg:     &protocol.EStopMessage{Type: protocol.TypeEStop, T: now},
			checkFn: func() {
				if robot.estopCalls == 0 {
					t.Error("e-stop not called")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset
			robot.driveCalls = nil
			robot.keyCalls = nil
			robot.mouseCalls = nil
			robot.estopCalls = 0

			data, _ := json.Marshal(tt.msg)
			_, err := h.HandleMessage(data)
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			tt.checkFn()
		})
	}
}

func TestHandler_HandleMessage_InvalidJSON(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, 500*time.Millisecond)

	_, err := h.HandleMessage([]byte("not json"))
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestHandler_HandleMessage_UnknownType(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, 500*time.Millisecond)

	data := []byte(`{"type": "unknown_type"}`)
	_, err := h.HandleMessage(data)
	if err == nil {
		t.Error("expected error for unknown type")
	}
}

func TestHandler_ValidationFailure(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, 500*time.Millisecond)

	// Out of range velocity
	msg := &protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    2.0, // Invalid
		W:    0,
		T:    time.Now().UnixMilli(),
	}

	err := h.HandleDrive(msg)
	if err == nil {
		t.Error("expected validation error")
	}

	// Robot should not be called
	if len(robot.driveCalls) != 0 {
		t.Error("robot should not be called for invalid command")
	}
}
