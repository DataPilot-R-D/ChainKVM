package control

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

func TestHandler_HandleMessage_Dispatch(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	tests := []struct {
		name    string
		msg     any
		checkFn func()
	}{
		{
			name: "drive dispatch",
			msg:  &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.1, W: 0.2, T: now},
			checkFn: func() {
				if len(robot.driveCalls) == 0 {
					t.Error("drive not called")
				}
			},
		},
		{
			name: "kvm_key dispatch",
			msg:  &protocol.KVMKeyMessage{Type: protocol.TypeKVMKey, Key: "KeyB", Action: "down", T: now},
			checkFn: func() {
				if len(robot.keyCalls) == 0 {
					t.Error("key not called")
				}
			},
		},
		{
			name: "kvm_mouse dispatch",
			msg:  &protocol.KVMMouseMessage{Type: protocol.TypeKVMMouse, DX: 1, DY: 1, T: now},
			checkFn: func() {
				if len(robot.mouseCalls) == 0 {
					t.Error("mouse not called")
				}
			},
		},
		{
			name: "e_stop dispatch",
			msg:  &protocol.EStopMessage{Type: protocol.TypeEStop, T: now},
			checkFn: func() {
				if robot.estopCalls == 0 {
					t.Error("e-stop not called")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
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
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	_, err := h.HandleMessage([]byte("not json"))
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestHandler_HandleMessage_UnknownType(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	data := []byte(`{"type": "unknown_type"}`)
	_, err := h.HandleMessage(data)
	if err == nil {
		t.Error("expected error for unknown type")
	}
}

func TestHandler_HandleMessage_PingIgnored(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	data := []byte(`{"type": "ping", "seq": 1, "t_mono": 12345}`)
	ack, err := h.HandleMessage(data)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if ack != nil {
		t.Error("ping should not return ack")
	}
}

func TestHandler_KVMKey_RobotError(t *testing.T) {
	robot := &mockRobotAPI{shouldError: true}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.KVMKeyMessage{
		Type:   protocol.TypeKVMKey,
		Key:    "KeyA",
		Action: "down",
		T:      now,
	}

	err := h.HandleKVMKey(msg)
	if err == nil {
		t.Error("expected error from robot API")
	}
}

func TestHandler_KVMMouse_RobotError(t *testing.T) {
	robot := &mockRobotAPI{shouldError: true}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.KVMMouseMessage{
		Type: protocol.TypeKVMMouse,
		DX:   10,
		DY:   5,
		T:    now,
	}

	err := h.HandleKVMMouse(msg)
	if err == nil {
		t.Error("expected error from robot API")
	}
}

func TestHandler_ValidationFailure(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	msg := &protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    2.0, // Invalid - out of range
		W:    0,
		T:    time.Now().UnixMilli(),
	}

	err := h.HandleDrive(msg)
	if err == nil {
		t.Error("expected validation error")
	}

	if len(robot.driveCalls) != 0 {
		t.Error("robot should not be called for invalid command")
	}
}
