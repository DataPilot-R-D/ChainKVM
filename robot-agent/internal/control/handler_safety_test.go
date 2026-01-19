package control

import (
	"sync"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// mockSafetyCallback captures safety events for testing.
type mockSafetyCallback struct {
	mu           sync.Mutex
	validCount   int
	invalidCount int
	estopCount   int
}

func (m *mockSafetyCallback) OnValidControl() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.validCount++
}

func (m *mockSafetyCallback) OnInvalidCommand() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.invalidCount++
}

func (m *mockSafetyCallback) OnEStop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.estopCount++
}

func TestHandler_SafetyCallbacks(t *testing.T) {
	robot := &mockRobotAPI{}
	safety := &mockSafetyCallback{}
	h := NewHandler(robot, safety, nil, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	// Valid command should trigger OnValidControl
	msg := &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.5, W: 0.3, T: now}
	err := h.HandleDrive(msg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if safety.validCount != 1 {
		t.Errorf("expected 1 valid callback, got %d", safety.validCount)
	}

	// Invalid command should trigger OnInvalidCommand
	invalidMsg := &protocol.DriveMessage{Type: protocol.TypeDrive, V: 5.0, W: 0, T: now}
	err = h.HandleDrive(invalidMsg)
	if err == nil {
		t.Error("expected error for invalid command")
	}
	if safety.invalidCount != 1 {
		t.Errorf("expected 1 invalid callback, got %d", safety.invalidCount)
	}
}

func TestHandler_EStopWithSafety(t *testing.T) {
	robot := &mockRobotAPI{}
	safety := &mockSafetyCallback{}
	h := NewHandler(robot, safety, nil, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.EStopMessage{Type: protocol.TypeEStop, T: now}
	err := h.HandleEStop(msg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if safety.estopCount != 1 {
		t.Errorf("expected 1 e-stop callback, got %d", safety.estopCount)
	}
}

func TestHandler_KVMKey_ValidationFailure(t *testing.T) {
	robot := &mockRobotAPI{}
	safety := &mockSafetyCallback{}
	h := NewHandler(robot, safety, nil, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	// Invalid action
	msg := &protocol.KVMKeyMessage{
		Type:   protocol.TypeKVMKey,
		Key:    "KeyA",
		Action: "invalid",
		T:      now,
	}

	err := h.HandleKVMKey(msg)
	if err == nil {
		t.Error("expected validation error")
	}
	if safety.invalidCount != 1 {
		t.Errorf("expected 1 invalid callback, got %d", safety.invalidCount)
	}
}

func TestHandler_KVMMouse_ValidationFailure(t *testing.T) {
	robot := &mockRobotAPI{}
	safety := &mockSafetyCallback{}
	h := NewHandler(robot, safety, nil, nil, 500*time.Millisecond)

	// Stale command
	msg := &protocol.KVMMouseMessage{
		Type: protocol.TypeKVMMouse,
		DX:   10,
		DY:   5,
		T:    time.Now().UnixMilli() - 1000,
	}

	err := h.HandleKVMMouse(msg)
	if err == nil {
		t.Error("expected validation error")
	}
	if safety.invalidCount != 1 {
		t.Errorf("expected 1 invalid callback, got %d", safety.invalidCount)
	}
}
