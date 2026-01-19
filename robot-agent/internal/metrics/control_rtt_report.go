package metrics

import (
	"encoding/json"
	"fmt"
	"time"
)

// ControlRTTTargets defines performance targets for control RTT.
type ControlRTTTargets struct {
	P50 time.Duration `json:"p50"`
	P95 time.Duration `json:"p95"`
}

// ControlRTTReport contains statistical analysis of control RTT measurements.
type ControlRTTReport struct {
	GeneratedAt time.Time          `json:"generated_at"`
	SampleCount int                `json:"sample_count"`
	Stats       RevocationStats    `json:"stats"`
	MeetsTarget bool               `json:"meets_target"`
	Targets     ControlRTTTargets  `json:"targets"`
}

// DefaultControlRTTTargets returns LAN targets from NFR-P2.
func DefaultControlRTTTargets() ControlRTTTargets {
	return ControlRTTTargets{
		P50: 50 * time.Millisecond,  // LAN target: p50 ≤ 50ms
		P95: 150 * time.Millisecond, // WAN target: p50 ≤ 150ms
	}
}

// GenerateReport creates a statistical report from collected samples.
func (c *ControlRTTCollector) GenerateReport(targets ControlRTTTargets) ControlRTTReport {
	c.mu.Lock()
	defer c.mu.Unlock()

	stats := c.statsLocked()
	meetsTarget := stats.P50 <= targets.P50 && stats.P95 <= targets.P95

	return ControlRTTReport{
		GeneratedAt: time.Now().UTC(),
		SampleCount: len(c.samples),
		Stats:       stats,
		MeetsTarget: meetsTarget,
		Targets:     targets,
	}
}

// String returns a human-readable report.
func (r ControlRTTReport) String() string {
	var result string
	result += "=== Control RTT Report ===\n"
	result += fmt.Sprintf("Generated: %s\n", r.GeneratedAt.Format(time.RFC3339))
	result += fmt.Sprintf("Sample Count: %d\n", r.SampleCount)
	result += "\nStatistics:\n"
	result += fmt.Sprintf("  P50: %v\n", r.Stats.P50)
	result += fmt.Sprintf("  P95: %v\n", r.Stats.P95)
	result += fmt.Sprintf("  P99: %v\n", r.Stats.P99)
	result += fmt.Sprintf("  Min: %v\n", r.Stats.Min)
	result += fmt.Sprintf("  Max: %v\n", r.Stats.Max)
	result += fmt.Sprintf("  Avg: %v\n", r.Stats.Avg)
	result += "\nTargets:\n"
	result += fmt.Sprintf("  P50: %v\n", r.Targets.P50)
	result += fmt.Sprintf("  P95: %v\n", r.Targets.P95)
	result += fmt.Sprintf("\nMeets Target: %v\n", r.MeetsTarget)
	return result
}

// JSON returns the report as JSON.
func (r ControlRTTReport) JSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}
