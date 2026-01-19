package main

import (
	"testing"
	"time"

	"go.uber.org/zap"

	"github.com/datapilot/chainkvm/robot-agent/internal/metrics"
	"github.com/datapilot/chainkvm/robot-agent/internal/safety"
	"github.com/datapilot/chainkvm/robot-agent/internal/session"
)

// TestRevocationMeasurement_TimestampCapture verifies that OnRevoked captures
// timestamps at each stage of the revocation flow.
func TestRevocationMeasurement_TimestampCapture(t *testing.T) {
	logger := zap.NewNop()

	// Create minimal agent with metrics collector (nil transport - OnRevoked handles nil)
	a := &agent{
		logger:            logger,
		transport:         nil,
		sessionMgr:        session.NewManager("test-robot", nil),
		safety:            safety.NewMonitor(1*time.Second, 5, 30*time.Second, nil),
		revocationMetrics: metrics.NewRevocationCollector(100),
	}

	// Set up safe-stop callback to capture final timestamps
	a.safety = safety.NewMonitor(1*time.Second, 5, 30*time.Second, func(trigger safety.Trigger) safety.TransitionResult {
		return a.onSafeStop(trigger)
	})

	// Initialize handler for hardware stop (use nil robot API - we just need structure)
	a.handler = nil

	startTime := time.Now()

	// Trigger revocation
	a.OnRevoked("test-session-123", "test revocation")

	// Verify measurement was recorded
	if a.revocationMetrics.Count() != 1 {
		t.Fatalf("expected 1 measurement recorded, got %d", a.revocationMetrics.Count())
	}

	// Verify stats are populated
	stats := a.revocationMetrics.Stats()
	if stats.Count != 1 {
		t.Errorf("expected stats count 1, got %d", stats.Count)
	}

	// Verify total propagation time is reasonable (< 1s for test)
	if stats.Max > 1*time.Second {
		t.Errorf("total propagation time too high: %v", stats.Max)
	}

	// Verify measurement was captured after start time
	if stats.Min < 0 {
		t.Error("measurement duration should be positive")
	}

	endTime := time.Now()
	elapsed := endTime.Sub(startTime)
	if stats.Max > elapsed {
		t.Errorf("measurement duration (%v) exceeds test elapsed time (%v)", stats.Max, elapsed)
	}
}

// TestRevocationMeasurement_MultipleRevocations verifies that multiple
// revocations are recorded correctly.
func TestRevocationMeasurement_MultipleRevocations(t *testing.T) {
	logger := zap.NewNop()
	collector := metrics.NewRevocationCollector(100)

	// Trigger multiple revocations (reset safety monitor each time since it's idempotent)
	for i := range 5 {
		a := &agent{
			logger:            logger,
			transport:         nil,
			sessionMgr:        session.NewManager("test-robot", nil),
			revocationMetrics: collector,
		}
		a.safety = safety.NewMonitor(1*time.Second, 5, 30*time.Second, func(trigger safety.Trigger) safety.TransitionResult {
			return a.onSafeStop(trigger)
		})
		a.OnRevoked("session-"+string(rune('A'+i)), "test")
	}

	if collector.Count() != 5 {
		t.Errorf("expected 5 measurements, got %d", collector.Count())
	}

	stats := collector.Stats()
	if stats.Count != 5 {
		t.Errorf("expected stats count 5, got %d", stats.Count)
	}
}

// TestRevocationMeasurement_ReportGeneration verifies that reports can be
// generated from collected measurements.
func TestRevocationMeasurement_ReportGeneration(t *testing.T) {
	logger := zap.NewNop()
	collector := metrics.NewRevocationCollector(100)

	// Trigger revocations (reset safety monitor each time since it's idempotent)
	for range 3 {
		a := &agent{
			logger:            logger,
			transport:         nil,
			sessionMgr:        session.NewManager("test-robot", nil),
			revocationMetrics: collector,
		}
		a.safety = safety.NewMonitor(1*time.Second, 5, 30*time.Second, func(trigger safety.Trigger) safety.TransitionResult {
			return a.onSafeStop(trigger)
		})
		a.OnRevoked("test-session", "test")
	}

	// Generate report
	report := collector.GenerateReport(metrics.DefaultTargets())

	if report.SampleCount != 3 {
		t.Errorf("expected 3 samples in report, got %d", report.SampleCount)
	}

	// Verify JSON output
	jsonData, err := report.JSON()
	if err != nil {
		t.Fatalf("failed to generate JSON report: %v", err)
	}
	if len(jsonData) == 0 {
		t.Error("JSON report should not be empty")
	}

	// Verify string output
	str := report.String()
	if len(str) == 0 {
		t.Error("string report should not be empty")
	}

	// Fast revocations should meet targets
	if !report.MeetsTarget {
		t.Error("expected report to meet targets for fast test revocations")
	}
}

// TestRevocationMeasurement_MetricsAccessor verifies the RevocationMetrics
// accessor method returns the collector.
func TestRevocationMeasurement_MetricsAccessor(t *testing.T) {
	collector := metrics.NewRevocationCollector(50)
	a := &agent{
		revocationMetrics: collector,
	}

	if a.RevocationMetrics() != collector {
		t.Error("RevocationMetrics() should return the collector")
	}
}
