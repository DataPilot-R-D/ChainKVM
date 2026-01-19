package control

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

// TestEStop_UnderCommandLoad verifies E-Stop is processed during high command rate.
func TestEStop_UnderCommandLoad(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	stopCh, cmdCount := startCommandStream(h)
	time.Sleep(100 * time.Millisecond)

	estopLatency := measureEStopLatency(t, h)
	close(stopCh)

	t.Logf("Commands processed: %d, E-Stop latency: %v", atomic.LoadInt32(cmdCount), estopLatency)
	assertLatencyUnder100ms(t, estopLatency)
	verifyEStopCalls(t, robot, 1)
}

// TestEStop_InterleavedWithDriveCommands verifies E-Stop works when
// interleaved with drive commands from multiple goroutines.
func TestEStop_InterleavedWithDriveCommands(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	stopCh := startConcurrentCommandSenders(h, 5)
	time.Sleep(50 * time.Millisecond)

	if err := h.HandleEStop(newEStopMessage()); err != nil {
		t.Fatalf("E-Stop failed during concurrent commands: %v", err)
	}
	close(stopCh)

	verifyEStopCalls(t, robot, 1)
}

// TestEStop_ConcurrentEStops verifies multiple concurrent E-Stops are handled safely.
func TestEStop_ConcurrentEStops(t *testing.T) {
	robot := &mockRobotAPI{}
	h := NewHandler(robot, nil, nil, nil, 500*time.Millisecond)

	errCount := sendConcurrentEStops(h, 100)
	if errCount > 0 {
		t.Errorf("got %d errors from concurrent E-Stops", errCount)
	}

	verifyEStopCalls(t, robot, 100)
}

// TestEStop_SafetyCallbackTiming verifies E-Stop completes within timing budget.
func TestEStop_SafetyCallbackTiming(t *testing.T) {
	robot := &mockRobotAPI{}
	safety := &delayedSafetyCallback{delay: 50 * time.Millisecond}
	h := NewHandler(robot, safety, nil, nil, 500*time.Millisecond)

	start := time.Now()
	if err := h.HandleEStop(newEStopMessage()); err != nil {
		t.Fatalf("E-Stop failed: %v", err)
	}
	duration := time.Since(start)

	assertLatencyUnder100ms(t, duration)
}

// startCommandStream starts a goroutine sending drive commands at ~100 cmd/sec.
// Returns a stop channel and a counter for processed commands.
func startCommandStream(h *Handler) (chan struct{}, *int32) {
	stopCh := make(chan struct{})
	cmdCount := int32(0)

	go func() {
		ticker := time.NewTicker(10 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-stopCh:
				return
			case <-ticker.C:
				msg := &protocol.DriveMessage{
					Type: protocol.TypeDrive, V: 0.5, W: 0.1,
					T: time.Now().UnixMilli(),
				}
				_ = h.HandleDrive(msg)
				atomic.AddInt32(&cmdCount, 1)
			}
		}
	}()

	return stopCh, &cmdCount
}

// startConcurrentCommandSenders starts n goroutines sending drive commands.
func startConcurrentCommandSenders(h *Handler, n int) chan struct{} {
	stopCh := make(chan struct{})

	for range n {
		go func() {
			for {
				select {
				case <-stopCh:
					return
				default:
					msg := &protocol.DriveMessage{
						Type: protocol.TypeDrive, V: 0.5, W: 0.1,
						T: time.Now().UnixMilli(),
					}
					_ = h.HandleDrive(msg)
				}
			}
		}()
	}

	return stopCh
}

// sendConcurrentEStops sends n concurrent E-Stops and returns error count.
func sendConcurrentEStops(h *Handler, n int) int32 {
	var wg sync.WaitGroup
	var errCount int32

	for range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := h.HandleEStop(newEStopMessage()); err != nil {
				atomic.AddInt32(&errCount, 1)
			}
		}()
	}

	wg.Wait()
	return errCount
}

// measureEStopLatency sends an E-Stop and returns the latency.
func measureEStopLatency(t *testing.T, h *Handler) time.Duration {
	t.Helper()
	start := time.Now()
	if err := h.HandleEStop(newEStopMessage()); err != nil {
		t.Fatalf("E-Stop failed: %v", err)
	}
	return time.Since(start)
}

// assertLatencyUnder100ms fails if latency exceeds 100ms.
func assertLatencyUnder100ms(t *testing.T, latency time.Duration) {
	t.Helper()
	if latency >= 100*time.Millisecond {
		t.Errorf("latency %v exceeds 100ms limit", latency)
	}
}

// delayedSafetyCallback adds artificial delay to simulate slow processing.
type delayedSafetyCallback struct {
	delay time.Duration
}

func (s *delayedSafetyCallback) OnValidControl()   {}
func (s *delayedSafetyCallback) OnInvalidCommand() {}
func (s *delayedSafetyCallback) OnEStop()          { time.Sleep(s.delay) }
