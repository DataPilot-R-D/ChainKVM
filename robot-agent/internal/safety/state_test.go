package safety

import (
	"testing"
)

func TestStateMachine_InitialState(t *testing.T) {
	sm := NewStateMachine()

	if sm.State() != StateIdle {
		t.Errorf("expected initial state Idle, got %s", sm.State())
	}
}

func TestStateMachine_IdleToActive(t *testing.T) {
	sm := NewStateMachine()

	err := sm.Transition(EventAuthorized)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sm.State() != StateActive {
		t.Errorf("expected Active, got %s", sm.State())
	}
}

func TestStateMachine_ActiveToSafeStop(t *testing.T) {
	sm := NewStateMachine()

	// First go to Active
	sm.Transition(EventAuthorized)

	triggers := []Event{EventEStop, EventControlLoss, EventInvalidThreshold, EventTokenExpired, EventRevoked}

	for _, trigger := range triggers {
		t.Run(string(trigger), func(t *testing.T) {
			sm := NewStateMachine()
			sm.Transition(EventAuthorized)

			err := sm.Transition(trigger)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if sm.State() != StateSafeStop {
				t.Errorf("expected SafeStop, got %s", sm.State())
			}
		})
	}
}

func TestStateMachine_SafeStopToIdle(t *testing.T) {
	sm := NewStateMachine()

	// Go to Active then SafeStop
	sm.Transition(EventAuthorized)
	sm.Transition(EventEStop)

	if sm.State() != StateSafeStop {
		t.Fatalf("expected SafeStop, got %s", sm.State())
	}

	// Reset to Idle
	err := sm.Transition(EventReset)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sm.State() != StateIdle {
		t.Errorf("expected Idle after reset, got %s", sm.State())
	}
}

func TestStateMachine_InvalidTransition_IdleToSafeStop(t *testing.T) {
	sm := NewStateMachine()

	// Can't go directly from Idle to SafeStop via e-stop
	// (need to be Active first to have something to stop)
	err := sm.Transition(EventEStop)
	if err == nil {
		t.Error("expected error for invalid transition")
	}
}

func TestStateMachine_InvalidTransition_ActiveToIdle(t *testing.T) {
	sm := NewStateMachine()
	sm.Transition(EventAuthorized)

	// Can't go directly from Active to Idle without SafeStop
	err := sm.Transition(EventReset)
	if err == nil {
		t.Error("expected error for invalid transition")
	}
}

func TestStateMachine_StateChangeCallback(t *testing.T) {
	sm := NewStateMachine()

	var changes []StateChange

	sm.OnStateChange(func(change StateChange) {
		changes = append(changes, change)
	})

	sm.Transition(EventAuthorized)
	sm.Transition(EventEStop)
	sm.Transition(EventReset)

	if len(changes) != 3 {
		t.Fatalf("expected 3 state changes, got %d", len(changes))
	}

	// Check transitions
	expected := []struct {
		from  State
		to    State
		event Event
	}{
		{StateIdle, StateActive, EventAuthorized},
		{StateActive, StateSafeStop, EventEStop},
		{StateSafeStop, StateIdle, EventReset},
	}

	for i, exp := range expected {
		if changes[i].From != exp.from {
			t.Errorf("change %d: expected from=%s, got %s", i, exp.from, changes[i].From)
		}
		if changes[i].To != exp.to {
			t.Errorf("change %d: expected to=%s, got %s", i, exp.to, changes[i].To)
		}
		if changes[i].Event != exp.event {
			t.Errorf("change %d: expected event=%s, got %s", i, exp.event, changes[i].Event)
		}
	}
}

func TestStateMachine_CanTransition(t *testing.T) {
	sm := NewStateMachine()

	// From Idle
	if !sm.CanTransition(EventAuthorized) {
		t.Error("should be able to transition on Authorized from Idle")
	}
	if sm.CanTransition(EventEStop) {
		t.Error("should not be able to e-stop from Idle")
	}

	// Go to Active
	sm.Transition(EventAuthorized)

	if !sm.CanTransition(EventEStop) {
		t.Error("should be able to e-stop from Active")
	}
	if sm.CanTransition(EventAuthorized) {
		t.Error("should not be able to re-authorize from Active")
	}
}

func TestStateMachine_IsActive(t *testing.T) {
	sm := NewStateMachine()

	if sm.IsActive() {
		t.Error("should not be active initially")
	}

	sm.Transition(EventAuthorized)

	if !sm.IsActive() {
		t.Error("should be active after authorization")
	}

	sm.Transition(EventEStop)

	if sm.IsActive() {
		t.Error("should not be active after safe-stop")
	}
}

func TestStateMachine_IsSafeStopped(t *testing.T) {
	sm := NewStateMachine()

	if sm.IsSafeStopped() {
		t.Error("should not be safe-stopped initially")
	}

	sm.Transition(EventAuthorized)
	sm.Transition(EventEStop)

	if !sm.IsSafeStopped() {
		t.Error("should be safe-stopped after e-stop")
	}
}
