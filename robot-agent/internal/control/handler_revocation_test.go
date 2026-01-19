package control

import (
	"encoding/json"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// atomicSessionChecker is a thread-safe session checker for concurrent tests.
type atomicSessionChecker struct {
	active atomic.Bool
}

func (a *atomicSessionChecker) IsActive() bool {
	return a.active.Load()
}

func (a *atomicSessionChecker) setActive(v bool) {
	a.active.Store(v)
}

// TestRevocation_ConcurrentCommands verifies commands are properly rejected
// when session is revoked, using deterministic two-phase approach.
func TestRevocation_ConcurrentCommands(t *testing.T) {
	robot := &mockRobotAPI{}
	session := &atomicSessionChecker{}
	session.setActive(true)
	h := NewHandler(robot, nil, nil, session, 500*time.Millisecond)

	var wg sync.WaitGroup
	var successCount, revokedCount int32

	// Phase 1: Commands with active session
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			msg := &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.5, W: 0.1, T: time.Now().UnixMilli()}
			data, _ := json.Marshal(msg)
			if _, err := h.HandleMessage(data); err == nil {
				atomic.AddInt32(&successCount, 1)
			}
		}()
	}
	wg.Wait()

	// Revoke session
	session.setActive(false)

	// Phase 2: Commands with revoked session
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			msg := &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.5, W: 0.1, T: time.Now().UnixMilli()}
			data, _ := json.Marshal(msg)
			if _, err := h.HandleMessage(data); err == ErrSessionRevoked {
				atomic.AddInt32(&revokedCount, 1)
			}
		}()
	}
	wg.Wait()

	if successCount != 10 {
		t.Errorf("expected 10 commands to succeed before revocation, got %d", successCount)
	}
	if revokedCount != 10 {
		t.Errorf("expected 10 commands to be rejected after revocation, got %d", revokedCount)
	}
}

// TestRevocation_NoSafetyCallbackAfterRevocation verifies that commands
// after revocation don't trigger safety callbacks.
func TestRevocation_NoSafetyCallbackAfterRevocation(t *testing.T) {
	robot := &mockRobotAPI{}
	safety := &mockSafetyCallback{}
	session := &mockSessionChecker{active: true}
	h := NewHandler(robot, safety, nil, session, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	// First command succeeds and triggers safety callback
	msg := &protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    now,
	}
	data, _ := json.Marshal(msg)
	_, err := h.HandleMessage(data)
	if err != nil {
		t.Fatalf("first command should succeed: %v", err)
	}

	safety.mu.Lock()
	initialCount := safety.validCount
	safety.mu.Unlock()

	if initialCount != 1 {
		t.Errorf("expected 1 safety callback, got %d", initialCount)
	}

	// Revoke session
	session.active = false

	// Subsequent commands should NOT trigger safety callbacks
	for range 5 {
		_, _ = h.HandleMessage(data)
	}

	safety.mu.Lock()
	finalCount := safety.validCount
	safety.mu.Unlock()

	if finalCount != initialCount {
		t.Errorf("safety callbacks should not increase after revocation: before=%d, after=%d",
			initialCount, finalCount)
	}
}

// TestRevocation_RaceConditionSafety verifies thread safety under concurrent state changes.
// Run with -race flag to detect data races.
func TestRevocation_RaceConditionSafety(t *testing.T) {
	robot := &mockRobotAPI{}
	session := &atomicSessionChecker{}
	session.setActive(true)
	h := NewHandler(robot, nil, nil, session, 500*time.Millisecond)

	var wg sync.WaitGroup
	var cmdCount int32
	for range 20 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 10 {
				msg := &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.3, W: 0.1, T: time.Now().UnixMilli()}
				data, _ := json.Marshal(msg)
				_, _ = h.HandleMessage(data)
				atomic.AddInt32(&cmdCount, 1)
			}
		}()
	}
	go func() {
		for range 50 {
			session.setActive(!session.active.Load())
			time.Sleep(50 * time.Microsecond)
		}
	}()
	wg.Wait()

	if cmdCount != 200 {
		t.Errorf("expected 200 commands processed, got %d", cmdCount)
	}
}

// TestRevocation_MultipleTypes verifies all command types are rejected
// after revocation.
func TestRevocation_MultipleTypes(t *testing.T) {
	robot := &mockRobotAPI{}
	session := &mockSessionChecker{active: false}
	h := NewHandler(robot, nil, nil, session, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	tests := []struct {
		name string
		msg  any
	}{
		{"Drive", &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.5, W: 0.1, T: now}},
		{"KVMKey", &protocol.KVMKeyMessage{Type: protocol.TypeKVMKey, Key: "A", Action: "down", T: now}},
		{"KVMMouse", &protocol.KVMMouseMessage{Type: protocol.TypeKVMMouse, DX: 10, DY: 5, T: now}},
		{"EStop", &protocol.EStopMessage{Type: protocol.TypeEStop, T: now}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, _ := json.Marshal(tt.msg)
			_, err := h.HandleMessage(data)

			if err != ErrSessionRevoked {
				t.Errorf("expected ErrSessionRevoked for %s, got %v", tt.name, err)
			}
		})
	}

	// Verify no robot calls were made
	robot.mu.Lock()
	calls := len(robot.driveCalls) + len(robot.keyCalls) + len(robot.mouseCalls) + robot.estopCalls
	robot.mu.Unlock()

	if calls != 0 {
		t.Errorf("expected no robot calls after revocation, got %d", calls)
	}
}

// TestRevocation_SessionReactivation verifies commands work again
// if session is reactivated (for session manager reset scenarios).
func TestRevocation_SessionReactivation(t *testing.T) {
	robot := &mockRobotAPI{}
	session := &mockSessionChecker{active: true}
	h := NewHandler(robot, nil, nil, session, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.DriveMessage{
		Type: protocol.TypeDrive,
		V:    0.5,
		W:    0.3,
		T:    now,
	}
	data, _ := json.Marshal(msg)

	// Command succeeds
	_, err := h.HandleMessage(data)
	if err != nil {
		t.Fatalf("initial command should succeed: %v", err)
	}

	// Revoke
	session.active = false
	_, err = h.HandleMessage(data)
	if err != ErrSessionRevoked {
		t.Errorf("expected ErrSessionRevoked, got %v", err)
	}

	// Reactivate (new session)
	session.active = true
	_, err = h.HandleMessage(data)
	if err != nil {
		t.Errorf("command should succeed after reactivation: %v", err)
	}

	robot.mu.Lock()
	count := len(robot.driveCalls)
	robot.mu.Unlock()

	if count != 2 {
		t.Errorf("expected 2 drive calls (before and after revocation), got %d", count)
	}
}
