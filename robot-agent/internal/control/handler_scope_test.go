package control

import (
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// mockScopeChecker for testing scope enforcement.
type mockScopeChecker struct {
	allowedScopes map[string]bool
}

func (m *mockScopeChecker) HasScope(scope string) bool {
	return m.allowedScopes[scope]
}

func TestHandler_ScopeEnforcement_Drive(t *testing.T) {
	robot := &mockRobotAPI{}
	scopes := &mockScopeChecker{allowedScopes: map[string]bool{}}
	h := NewHandler(robot, nil, scopes, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.5, W: 0.3, T: now}

	// Without control scope, should be rejected
	err := h.HandleDrive(msg)
	if err != ErrScopeNotAllowed {
		t.Errorf("expected ErrScopeNotAllowed, got %v", err)
	}

	// With control scope, should succeed
	scopes.allowedScopes[ScopeControl] = true
	err = h.HandleDrive(msg)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestHandler_ScopeEnforcement_KVMKey(t *testing.T) {
	robot := &mockRobotAPI{}
	scopes := &mockScopeChecker{allowedScopes: map[string]bool{}}
	h := NewHandler(robot, nil, scopes, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.KVMKeyMessage{Type: protocol.TypeKVMKey, Key: "KeyA", Action: "down", T: now}

	err := h.HandleKVMKey(msg)
	if err != ErrScopeNotAllowed {
		t.Errorf("expected ErrScopeNotAllowed, got %v", err)
	}

	scopes.allowedScopes[ScopeControl] = true
	err = h.HandleKVMKey(msg)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestHandler_ScopeEnforcement_KVMMouse(t *testing.T) {
	robot := &mockRobotAPI{}
	scopes := &mockScopeChecker{allowedScopes: map[string]bool{}}
	h := NewHandler(robot, nil, scopes, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.KVMMouseMessage{Type: protocol.TypeKVMMouse, DX: 10, DY: 5, T: now}

	err := h.HandleKVMMouse(msg)
	if err != ErrScopeNotAllowed {
		t.Errorf("expected ErrScopeNotAllowed, got %v", err)
	}

	scopes.allowedScopes[ScopeControl] = true
	err = h.HandleKVMMouse(msg)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestHandler_ScopeEnforcement_EStop_AlwaysAllowed(t *testing.T) {
	robot := &mockRobotAPI{}
	scopes := &mockScopeChecker{allowedScopes: map[string]bool{}}
	h := NewHandler(robot, nil, scopes, nil, 500*time.Millisecond)
	now := time.Now().UnixMilli()

	msg := &protocol.EStopMessage{Type: protocol.TypeEStop, T: now}

	// E-Stop should always be allowed for safety
	err := h.HandleEStop(msg)
	if err != nil {
		t.Errorf("e-stop should always be allowed: %v", err)
	}
}
