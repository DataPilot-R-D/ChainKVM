package control

import (
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
	return nil
}

func TestHandler_HandleDrive(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, 500*time.Millisecond)
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
	h := NewHandler(robot, nil, nil, 500*time.Millisecond)
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
	h := NewHandler(robot, nil, nil, 500*time.Millisecond)
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
	h := NewHandler(robot, nil, nil, 500*time.Millisecond)
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
