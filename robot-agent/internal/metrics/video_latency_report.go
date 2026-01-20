package metrics

import (
	"encoding/json"
	"fmt"
	"time"
)

// VideoLatencyTargets defines performance targets for video latency.
type VideoLatencyTargets struct {
	P50 time.Duration `json:"p50"`
	P95 time.Duration `json:"p95"`
}

// VideoLatencyReport contains statistical analysis of video latency measurements.
type VideoLatencyReport struct {
	GeneratedAt time.Time           `json:"generated_at"`
	SampleCount int                 `json:"sample_count"`
	Stats       RevocationStats     `json:"stats"`
	MeetsTarget bool                `json:"meets_target"`
	Targets     VideoLatencyTargets `json:"targets"`
}

// DefaultVideoLatencyTargets returns LAN targets from NFR-P3.
func DefaultVideoLatencyTargets() VideoLatencyTargets {
	return VideoLatencyTargets{
		P50: 200 * time.Millisecond, // LAN target: p50 ≤ 200ms
		P95: 400 * time.Millisecond, // WAN target: p50 ≤ 400ms (used as P95 for LAN)
	}
}

// WANVideoLatencyTargets returns WAN targets from NFR-P3.
func WANVideoLatencyTargets() VideoLatencyTargets {
	return VideoLatencyTargets{
		P50: 400 * time.Millisecond,  // WAN target: p50 ≤ 400ms
		P95: 1000 * time.Millisecond, // Conservative P95 target for WAN
	}
}

// GenerateReport creates a statistical report from collected samples.
func (c *VideoLatencyCollector) GenerateReport(targets VideoLatencyTargets) VideoLatencyReport {
	c.mu.Lock()
	defer c.mu.Unlock()

	stats := c.statsLocked()
	meetsTarget := stats.P50 <= targets.P50 && stats.P95 <= targets.P95

	return VideoLatencyReport{
		GeneratedAt: time.Now().UTC(),
		SampleCount: len(c.samples),
		Stats:       stats,
		MeetsTarget: meetsTarget,
		Targets:     targets,
	}
}

// String returns a human-readable report.
func (r VideoLatencyReport) String() string {
	var result string
	result += "=== Video Latency Report ===\n"
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
func (r VideoLatencyReport) JSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}
