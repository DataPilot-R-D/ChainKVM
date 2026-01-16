// Package safety implements the Robot Agent safety subsystem.
package safety

import "log"

// Executor handles safe-stop execution.
type Executor struct {
	haltFn  func() error // Function to halt robot motion
	closeFn func() error // Function to close connections
}

// NewExecutor creates a new safe-stop executor.
func NewExecutor(haltFn, closeFn func() error) *Executor {
	return &Executor{
		haltFn:  haltFn,
		closeFn: closeFn,
	}
}

// Execute performs safe-stop sequence.
func (e *Executor) Execute(trigger Trigger) {
	log.Printf("safe-stop triggered: %s", trigger)

	// 1. Halt all motion immediately
	if e.haltFn != nil {
		if err := e.haltFn(); err != nil {
			log.Printf("error halting robot: %v", err)
		}
	}

	// 2. Close connections
	if e.closeFn != nil {
		if err := e.closeFn(); err != nil {
			log.Printf("error closing connections: %v", err)
		}
	}

	log.Printf("safe-stop complete: %s", trigger)
}
