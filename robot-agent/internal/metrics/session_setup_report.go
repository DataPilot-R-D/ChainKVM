package metrics

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// SessionSetupTargets defines target latencies for session setup.
type SessionSetupTargets struct {
	TotalP50 time.Duration `json:"total_p50"`
	TotalP95 time.Duration `json:"total_p95"`
}

// DefaultSessionSetupTargets returns the default targets from PRD NFR-P1.
func DefaultSessionSetupTargets() SessionSetupTargets {
	return SessionSetupTargets{
		TotalP50: 2 * time.Second,  // LAN: p50 ≤ 2s
		TotalP95: 5 * time.Second,  // LAN: p95 ≤ 5s
	}
}

// SessionSetupReport contains a complete session setup measurement report.
type SessionSetupReport struct {
	GeneratedAt time.Time           `json:"generated_at"`
	SampleCount int                 `json:"sample_count"`
	Total       RevocationStats     `json:"total_setup_time"`
	Breakdown   SessionSetupBreakdown `json:"breakdown"`
	MeetsTarget bool                `json:"meets_target"`
	Targets     SessionSetupTargets `json:"targets"`
}

// SessionSetupBreakdown contains stats for each setup phase.
type SessionSetupBreakdown struct {
	TokenValidation   RevocationStats `json:"token_validation"`
	WebRTCSetup       RevocationStats `json:"webrtc_setup"`
	IceNegotiation    RevocationStats `json:"ice_negotiation"`
	SessionActivation RevocationStats `json:"session_activation"`
}

// GenerateReport creates a measurement report from the collector.
func (c *SessionSetupCollector) GenerateReport(targets SessionSetupTargets) SessionSetupReport {
	c.mu.Lock()
	defer c.mu.Unlock()

	phaseStats := func(getPhase func(SessionSetupPhases) time.Duration) RevocationStats {
		return calculateSessionSetupStats(c.samples, func(ts SessionSetupTimestamps) time.Duration {
			return getPhase(ts.Calculate())
		})
	}

	totalStats := phaseStats(func(p SessionSetupPhases) time.Duration { return p.Total })

	return SessionSetupReport{
		GeneratedAt: time.Now().UTC(),
		SampleCount: len(c.samples),
		Total:       totalStats,
		Breakdown: SessionSetupBreakdown{
			TokenValidation:   phaseStats(func(p SessionSetupPhases) time.Duration { return p.TokenValidation }),
			WebRTCSetup:       phaseStats(func(p SessionSetupPhases) time.Duration { return p.WebRTCSetup }),
			IceNegotiation:    phaseStats(func(p SessionSetupPhases) time.Duration { return p.IceNegotiation }),
			SessionActivation: phaseStats(func(p SessionSetupPhases) time.Duration { return p.SessionActivation }),
		},
		MeetsTarget: totalStats.P50 <= targets.TotalP50 && totalStats.P95 <= targets.TotalP95,
		Targets:     targets,
	}
}

// JSON returns the report as JSON.
func (r SessionSetupReport) JSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}

// String returns a human-readable summary.
func (r SessionSetupReport) String() string {
	var sb strings.Builder

	sb.WriteString("=== Session Setup Measurement Report ===\n")
	sb.WriteString(fmt.Sprintf("Generated: %s\n", r.GeneratedAt.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("Samples: %d\n\n", r.SampleCount))

	sb.WriteString("Total Setup Time:\n")
	writeStats(&sb, r.Total)

	sb.WriteString("\nBreakdown:\n")
	sb.WriteString("  Token Validation:\n")
	writeStatsIndented(&sb, r.Breakdown.TokenValidation, "    ")
	sb.WriteString("  WebRTC Setup:\n")
	writeStatsIndented(&sb, r.Breakdown.WebRTCSetup, "    ")
	sb.WriteString("  ICE Negotiation:\n")
	writeStatsIndented(&sb, r.Breakdown.IceNegotiation, "    ")
	sb.WriteString("  Session Activation:\n")
	writeStatsIndented(&sb, r.Breakdown.SessionActivation, "    ")

	sb.WriteString("\nTargets:\n")
	sb.WriteString(fmt.Sprintf("  P50: %v (target: %v)\n", r.Total.P50, r.Targets.TotalP50))
	sb.WriteString(fmt.Sprintf("  P95: %v (target: %v)\n", r.Total.P95, r.Targets.TotalP95))

	if r.MeetsTarget {
		sb.WriteString("\n✓ PASS: All targets met\n")
	} else {
		sb.WriteString("\n✗ FAIL: Targets not met\n")
	}

	return sb.String()
}
