package metrics

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// RevocationReport contains a complete measurement report.
type RevocationReport struct {
	GeneratedAt time.Time         `json:"generated_at"`
	SampleCount int               `json:"sample_count"`
	Total       RevocationStats   `json:"total_propagation"`
	SafeStop    RevocationStats   `json:"safe_stop_execution"`
	Breakdown   PropagationStats  `json:"breakdown"`
	MeetsTarget bool              `json:"meets_target"`
	Targets     LatencyTargets    `json:"targets"`
}

// PropagationStats contains stats for each propagation phase.
type PropagationStats struct {
	HandlerProcessing RevocationStats `json:"handler_processing"`
	TransportTeardown RevocationStats `json:"transport_teardown"`
	SessionTeardown   RevocationStats `json:"session_teardown"`
}

// LatencyTargets defines the target latencies for pass/fail determination.
type LatencyTargets struct {
	TotalP95    time.Duration `json:"total_p95"`
	SafeStopMax time.Duration `json:"safe_stop_max"`
}

// DefaultTargets returns the default latency targets from PRD.
func DefaultTargets() LatencyTargets {
	return LatencyTargets{
		TotalP95:    1 * time.Second,   // LAN: p95 < 1s
		SafeStopMax: 100 * time.Millisecond, // FR-14: < 100ms
	}
}

// GenerateReport creates a measurement report from the collector.
func (c *RevocationCollector) GenerateReport(targets LatencyTargets) RevocationReport {
	c.mu.Lock()
	defer c.mu.Unlock()

	totalStats := calculateStats(c.measurements, func(t RevocationTimestamps) time.Duration {
		return t.Calculate().Total
	})

	safeStopStats := calculateStats(c.measurements, func(t RevocationTimestamps) time.Duration {
		return t.Calculate().SafeStopExecution
	})

	handlerStats := calculateStats(c.measurements, func(t RevocationTimestamps) time.Duration {
		return t.Calculate().HandlerProcessing
	})

	transportStats := calculateStats(c.measurements, func(t RevocationTimestamps) time.Duration {
		return t.Calculate().TransportTeardown
	})

	sessionStats := calculateStats(c.measurements, func(t RevocationTimestamps) time.Duration {
		return t.Calculate().SessionTeardown
	})

	meetsTarget := totalStats.P95 <= targets.TotalP95 &&
		safeStopStats.Max <= targets.SafeStopMax

	return RevocationReport{
		GeneratedAt: time.Now().UTC(),
		SampleCount: len(c.measurements),
		Total:       totalStats,
		SafeStop:    safeStopStats,
		Breakdown: PropagationStats{
			HandlerProcessing: handlerStats,
			TransportTeardown: transportStats,
			SessionTeardown:   sessionStats,
		},
		MeetsTarget: meetsTarget,
		Targets:     targets,
	}
}

// JSON returns the report as JSON.
func (r RevocationReport) JSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}

// String returns a human-readable summary.
func (r RevocationReport) String() string {
	var sb strings.Builder

	sb.WriteString("=== Revocation Propagation Measurement Report ===\n")
	sb.WriteString(fmt.Sprintf("Generated: %s\n", r.GeneratedAt.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("Samples: %d\n\n", r.SampleCount))

	sb.WriteString("Total Propagation Time:\n")
	writeStats(&sb, r.Total)

	sb.WriteString("\nSafe-Stop Execution Time:\n")
	writeStats(&sb, r.SafeStop)

	sb.WriteString("\nBreakdown:\n")
	sb.WriteString("  Handler Processing:\n")
	writeStatsIndented(&sb, r.Breakdown.HandlerProcessing, "    ")
	sb.WriteString("  Transport Teardown:\n")
	writeStatsIndented(&sb, r.Breakdown.TransportTeardown, "    ")
	sb.WriteString("  Session Teardown:\n")
	writeStatsIndented(&sb, r.Breakdown.SessionTeardown, "    ")

	sb.WriteString("\nTargets:\n")
	sb.WriteString(fmt.Sprintf("  Total P95: %v (target: %v)\n", r.Total.P95, r.Targets.TotalP95))
	sb.WriteString(fmt.Sprintf("  Safe-Stop Max: %v (target: %v)\n", r.SafeStop.Max, r.Targets.SafeStopMax))

	if r.MeetsTarget {
		sb.WriteString("\n✓ PASS: All targets met\n")
	} else {
		sb.WriteString("\n✗ FAIL: Targets not met\n")
	}

	return sb.String()
}

func writeStats(sb *strings.Builder, s RevocationStats) {
	if s.Count == 0 {
		sb.WriteString("  No data\n")
		return
	}
	sb.WriteString(fmt.Sprintf("  Count: %d\n", s.Count))
	sb.WriteString(fmt.Sprintf("  Min:   %v\n", s.Min))
	sb.WriteString(fmt.Sprintf("  P50:   %v\n", s.P50))
	sb.WriteString(fmt.Sprintf("  P95:   %v\n", s.P95))
	sb.WriteString(fmt.Sprintf("  P99:   %v\n", s.P99))
	sb.WriteString(fmt.Sprintf("  Max:   %v\n", s.Max))
	sb.WriteString(fmt.Sprintf("  Avg:   %v\n", s.Avg))
}

func writeStatsIndented(sb *strings.Builder, s RevocationStats, indent string) {
	if s.Count == 0 {
		sb.WriteString(indent + "No data\n")
		return
	}
	sb.WriteString(fmt.Sprintf("%sP50: %v, P95: %v, Max: %v\n", indent, s.P50, s.P95, s.Max))
}
