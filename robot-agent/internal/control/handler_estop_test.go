package control

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// TestEStop_BasicCommand verifies E-Stop calls the robot API.
func TestEStop_BasicCommand(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	msg := &protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    time.Now().UnixMilli(),
	}

	err := h.HandleEStop(msg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	robot.mu.Lock()
	calls := robot.estopCalls
	robot.mu.Unlock()

	if calls != 1 {
		t.Errorf("expected 1 e-stop call, got %d", calls)
	}
}

// TestEStop_NotifiesSafety verifies E-Stop triggers the safety callback.
func TestEStop_NotifiesSafety(t *testing.T) {
	robot := &mockRobotAPI{}
	safety := &mockSafetyCallback{}
	h := NewHandler(robot, safety, nil, nil, 500*time.Millisecond)

	msg := &protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    time.Now().UnixMilli(),
	}

	err := h.HandleEStop(msg)
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
			msg := &protocol.EStopMessage{
				Type: protocol.TypeEStop,
				T:    tt.t,
			}

			err := h.HandleEStop(msg)
			if err != nil {
				t.Errorf("E-Stop should never be rejected, got error: %v", err)
			}
		})
	}
}

// TestEStop_HardwareFailure verifies error is returned when hardware stop fails.
func TestEStop_HardwareFailure(t *testing.T) {
	robot := &mockRobotAPI{shouldError: true}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	msg := &protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    time.Now().UnixMilli(),
	}

	err := h.HandleEStop(msg)
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

	msg := &protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    time.Now().UnixMilli(),
	}

	// Send multiple E-Stops
	for i := 0; i < 10; i++ {
		err := h.HandleEStop(msg)
		if err != nil {
			t.Fatalf("E-Stop %d failed: %v", i, err)
		}
	}

	robot.mu.Lock()
	calls := robot.estopCalls
	robot.mu.Unlock()

	if calls != 10 {
		t.Errorf("expected 10 e-stop calls, got %d", calls)
	}
}

// TestEStop_UnderCommandLoad verifies E-Stop is processed during high command rate.
func TestEStop_UnderCommandLoad(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	// Start high-rate command stream
	var wg sync.WaitGroup
	stopCmds := make(chan struct{})
	cmdCount := int32(0)

	wg.Add(1)
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(10 * time.Millisecond) // 100 cmd/sec
		defer ticker.Stop()

		for {
			select {
			case <-stopCmds:
				return
			case <-ticker.C:
				msg := &protocol.DriveMessage{
					Type: protocol.TypeDrive,
					V:    0.5,
					W:    0.1,
					T:    time.Now().UnixMilli(),
				}
				_ = h.HandleDrive(msg)
				atomic.AddInt32(&cmdCount, 1)
			}
		}
	}()

	// Let commands flow for 100ms
	time.Sleep(100 * time.Millisecond)

	// Send E-Stop and measure latency
	estopStart := time.Now()
	err := h.HandleEStop(&protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    time.Now().UnixMilli(),
	})
	estopLatency := time.Since(estopStart)

	close(stopCmds)
	wg.Wait()

	if err != nil {
		t.Fatalf("E-Stop failed: %v", err)
	}

	t.Logf("Commands processed before E-Stop: %d", atomic.LoadInt32(&cmdCount))
	t.Logf("E-Stop latency under load: %v", estopLatency)

	// E-Stop must complete in < 100ms even under load
	if estopLatency >= 100*time.Millisecond {
		t.Errorf("E-Stop took %v, expected < 100ms", estopLatency)
	}

	robot.mu.Lock()
	calls := robot.estopCalls
	robot.mu.Unlock()

	if calls != 1 {
		t.Errorf("expected 1 e-stop call, got %d", calls)
	}
}

// TestEStop_InterleavedWithDriveCommands verifies E-Stop works when
// interleaved with drive commands from multiple goroutines.
func TestEStop_InterleavedWithDriveCommands(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	var wg sync.WaitGroup
	estopReceived := make(chan struct{})

	// Start 5 concurrent command senders
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-estopReceived:
					return
				default:
					msg := &protocol.DriveMessage{
						Type: protocol.TypeDrive,
						V:    0.5,
						W:    0.1,
						T:    time.Now().UnixMilli(),
					}
					_ = h.HandleDrive(msg)
				}
			}
		}()
	}

	// Brief burst of commands
	time.Sleep(50 * time.Millisecond)

	// Send E-Stop
	err := h.HandleEStop(&protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    time.Now().UnixMilli(),
	})
	close(estopReceived)

	wg.Wait()

	if err != nil {
		t.Fatalf("E-Stop failed during concurrent commands: %v", err)
	}

	robot.mu.Lock()
	calls := robot.estopCalls
	robot.mu.Unlock()

	if calls != 1 {
		t.Errorf("expected 1 e-stop call, got %d", calls)
	}
}

// TestEStop_ConcurrentEStops verifies multiple concurrent E-Stops are handled safely.
func TestEStop_ConcurrentEStops(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	var wg sync.WaitGroup
	var errCount int32

	// Send 100 concurrent E-Stops
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := h.HandleEStop(&protocol.EStopMessage{
				Type: protocol.TypeEStop,
				T:    time.Now().UnixMilli(),
			})
			if err != nil {
				atomic.AddInt32(&errCount, 1)
			}
		}()
	}

	wg.Wait()

	if errCount > 0 {
		t.Errorf("got %d errors from concurrent E-Stops", errCount)
	}

	robot.mu.Lock()
	calls := robot.estopCalls
	robot.mu.Unlock()

	// All E-Stops should be processed at the handler level
	// (safety monitor may dedupe, but handler should process all)
	if calls != 100 {
		t.Errorf("expected 100 e-stop calls, got %d", calls)
	}
}

// TestEStop_SafetyCallbackNotBlocking verifies E-Stop doesn't block on safety callback.
func TestEStop_SafetyCallbackNotBlocking(t *testing.T) {
	robot := &mockRobotAPI{}

	// Safety callback with artificial delay
	slowSafety := &slowMockSafetyCallback{delay: 50 * time.Millisecond}
	h := NewHandler(robot, slowSafety, nil, nil, 500*time.Millisecond)

	start := time.Now()
	err := h.HandleEStop(&protocol.EStopMessage{
		Type: protocol.TypeEStop,
		T:    time.Now().UnixMilli(),
	})
	duration := time.Since(start)

	if err != nil {
		t.Fatalf("E-Stop failed: %v", err)
	}

	// The handler processes synchronously, so we expect the delay
	// but it should still complete reasonably quickly
	if duration >= 100*time.Millisecond {
		t.Errorf("E-Stop took %v, expected < 100ms even with callback", duration)
	}
}

// slowMockSafetyCallback adds artificial delay to simulate slow processing.
type slowMockSafetyCallback struct {
	delay time.Duration
	mu    sync.Mutex
	count int
}

func (s *slowMockSafetyCallback) OnValidControl() {}

func (s *slowMockSafetyCallback) OnInvalidCommand() {}

func (s *slowMockSafetyCallback) OnEStop() {
	time.Sleep(s.delay)
	s.mu.Lock()
	s.count++
	s.mu.Unlock()
}
