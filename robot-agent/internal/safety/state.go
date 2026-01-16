// Package safety implements the Robot Agent safety subsystem.
package safety

import (
	"errors"
	"sync"
)

// State represents the robot's operational state.
type State string

const (
	StateIdle     State = "idle"
	StateActive   State = "active"
	StateSafeStop State = "safe_stop"
)

// Event represents a state transition trigger.
type Event string

const (
	EventAuthorized       Event = "authorized"
	EventEStop            Event = "e_stop"
	EventControlLoss      Event = "control_loss"
	EventInvalidThreshold Event = "invalid_threshold"
	EventTokenExpired     Event = "token_expired"
	EventRevoked          Event = "revoked"
	EventReset            Event = "reset"
)

// StateChange represents a state transition.
type StateChange struct {
	From  State
	To    State
	Event Event
}

// StateChangeCallback is called when state changes.
type StateChangeCallback func(change StateChange)

// ErrInvalidTransition indicates an invalid state transition.
var ErrInvalidTransition = errors.New("invalid state transition")

// StateMachine manages robot operational state.
type StateMachine struct {
	mu       sync.RWMutex
	state    State
	callback StateChangeCallback
}

// NewStateMachine creates a new state machine in Idle state.
func NewStateMachine() *StateMachine {
	return &StateMachine{
		state: StateIdle,
	}
}

// State returns the current state.
func (sm *StateMachine) State() State {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.state
}

// IsActive returns true if the robot is in Active state.
func (sm *StateMachine) IsActive() bool {
	return sm.State() == StateActive
}

// IsSafeStopped returns true if the robot is in SafeStop state.
func (sm *StateMachine) IsSafeStopped() bool {
	return sm.State() == StateSafeStop
}

// OnStateChange registers a callback for state changes.
func (sm *StateMachine) OnStateChange(cb StateChangeCallback) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.callback = cb
}

// CanTransition checks if a transition is valid from current state.
func (sm *StateMachine) CanTransition(event Event) bool {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.isValidTransition(sm.state, event)
}

// Transition attempts to transition to a new state based on event.
func (sm *StateMachine) Transition(event Event) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if !sm.isValidTransition(sm.state, event) {
		return ErrInvalidTransition
	}

	oldState := sm.state
	newState := sm.getNextState(sm.state, event)
	sm.state = newState

	if sm.callback != nil {
		// Call callback synchronously - caller can async if needed
		cb := sm.callback
		cb(StateChange{
			From:  oldState,
			To:    newState,
			Event: event,
		})
	}

	return nil
}

// isValidTransition checks if a transition is valid.
func (sm *StateMachine) isValidTransition(state State, event Event) bool {
	switch state {
	case StateIdle:
		return event == EventAuthorized

	case StateActive:
		switch event {
		case EventEStop, EventControlLoss, EventInvalidThreshold,
			EventTokenExpired, EventRevoked:
			return true
		}
		return false

	case StateSafeStop:
		return event == EventReset

	default:
		return false
	}
}

// getNextState returns the next state for a valid transition.
func (sm *StateMachine) getNextState(state State, event Event) State {
	switch state {
	case StateIdle:
		if event == EventAuthorized {
			return StateActive
		}

	case StateActive:
		switch event {
		case EventEStop, EventControlLoss, EventInvalidThreshold,
			EventTokenExpired, EventRevoked:
			return StateSafeStop
		}

	case StateSafeStop:
		if event == EventReset {
			return StateIdle
		}
	}

	return state // No change
}
