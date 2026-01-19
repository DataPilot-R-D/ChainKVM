package control

import (
	"errors"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// TestEStop_BasicCommand verifies E-Stop calls the robot API.
func TestEStop_BasicCommand(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	err := h.HandleEStop(newEStopMessage())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	verifyEStopCalls(t, robot, 1)
}

// TestEStop_NotifiesSafety verifies E-Stop triggers the safety callback.
func TestEStop_NotifiesSafety(t *testing.T) {
	robot := &mockRobotAPI{}
	safety := &mockSafetyCallback{}
	h := NewHandler(robot, safety, nil, nil, 500*time.Millisecond)

	err := h.HandleEStop(newEStopMessage())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	safety.mu.Lock()
	count := safety.estopCount
	safety.mu.Unlock()

	if count != 1 {
		t.Errorf("expected 1 safety e-stop callback, got %d", count)
	}
}

// TestEStop_NoTimestampValidation verifies E-Stop is not rejected for stale timestamps.
// This is critical: E-Stop must always be processed for safety.
func TestEStop_NoTimestampValidation(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	tests := []struct {
		name string
		t    int64
	}{
		{"zero timestamp", 0},
		{"very old timestamp", time.Now().Add(-1 * time.Hour).UnixMilli()},
		{"future timestamp", time.Now().Add(1 * time.Hour).UnixMilli()},
		{"current timestamp", time.Now().UnixMilli()},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg := &protocol.EStopMessage{Type: protocol.TypeEStop, T: tt.t}
			if err := h.HandleEStop(msg); err != nil {
				t.Errorf("E-Stop should never be rejected, got error: %v", err)
			}
		})
	}
}

// TestEStop_HardwareFailure verifies error is returned when hardware stop fails.
func TestEStop_HardwareFailure(t *testing.T) {
	robot := &mockRobotAPI{shouldError: true}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	err := h.HandleEStop(newEStopMessage())
	if err == nil {
		t.Error("expected error when hardware fails")
	}
	if !errors.Is(err, ErrRobotUnavailable) {
		t.Errorf("expected ErrRobotUnavailable, got %v", err)
	}
}

// TestEStop_Idempotent verifies multiple E-Stops don't cause errors.
func TestEStop_Idempotent(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	for i := range 10 {
		if err := h.HandleEStop(newEStopMessage()); err != nil {
			t.Fatalf("E-Stop %d failed: %v", i, err)
		}
	}

	verifyEStopCalls(t, robot, 10)
}

// newEStopMessage creates an E-Stop message with current timestamp.
func newEStopMessage() *protocol.EStopMessage {
	return &protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    time.Now().UnixMilli(),
	}
}

// verifyEStopCalls checks the number of E-Stop calls on the mock robot.
func verifyEStopCalls(t *testing.T, robot *mockRobotAPI, expected int) {
	t.Helper()
	robot.mu.Lock()
	calls := robot.estopCalls
	robot.mu.Unlock()

	if calls != expected {
		t.Errorf("expected %d e-stop call(s), got %d", expected, calls)
	}
}
