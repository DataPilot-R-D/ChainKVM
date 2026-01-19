package metrics

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// Profile represents a test environment profile.
type Profile string

const (
	// ProfileLAN represents local network conditions.
	ProfileLAN Profile = "lan"
	// ProfileWAN represents wide area network with simulated latency.
	ProfileWAN Profile = "wan"
)

// RunConfig configures a measurement run.
type RunConfig struct {
	Profile       Profile
	Iterations    int
	SimulatedRTT  time.Duration // For WAN simulation
	WarmupRuns    int           // Iterations to discard for warmup
}

// DefaultLANConfig returns default configuration for LAN testing.
func DefaultLANConfig() RunConfig {
	return RunConfig{
		Profile:      ProfileLAN,
		Iterations:   100,
		SimulatedRTT: 0,
		WarmupRuns:   5,
	}
}

// DefaultWANConfig returns default configuration for WAN testing.
func DefaultWANConfig() RunConfig {
	return RunConfig{
		Profile:      ProfileWAN,
		Iterations:   100,
		SimulatedRTT: 100 * time.Millisecond,
		WarmupRuns:   5,
	}
}

// Targets returns the latency targets for this profile.
func (c RunConfig) Targets() LatencyTargets {
	switch c.Profile {
	case ProfileWAN:
		return LatencyTargets{
			TotalP95:    2 * time.Second,
			SafeStopMax: 100 * time.Millisecond,
		}
	default:
		return DefaultTargets()
	}
}

// RevocationFunc is a function that triggers a revocation.
type RevocationFunc func(sessionID, reason string)

// MeasurementRunner executes revocation measurement tests.
type MeasurementRunner struct {
	collector *RevocationCollector
	config    RunConfig
}

// NewMeasurementRunner creates a new runner with the given configuration.
func NewMeasurementRunner(config RunConfig) *MeasurementRunner {
	maxSamples := config.Iterations + config.WarmupRuns + 10
	return &MeasurementRunner{
		collector: NewRevocationCollector(maxSamples),
		config:    config,
	}
}

// Collector returns the underlying collector for instrumentation.
func (r *MeasurementRunner) Collector() *RevocationCollector {
	return r.collector
}

// Run executes the measurement test using the provided revocation function.
func (r *MeasurementRunner) Run(revokeFn RevocationFunc) MeasurementResult {
	startTime := time.Now()
	r.collector.Reset()

	// Warmup runs (discarded)
	for i := range r.config.WarmupRuns {
		sessionID := fmt.Sprintf("warmup-%d", i)
		r.simulateLatency()
		revokeFn(sessionID, "warmup")
	}
	r.collector.Reset() // Discard warmup measurements

	// Actual measurement runs
	for i := range r.config.Iterations {
		sessionID := fmt.Sprintf("test-%d", i)
		r.simulateLatency()
		revokeFn(sessionID, "measurement")
	}

	report := r.collector.GenerateReport(r.config.Targets())
	duration := time.Since(startTime)

	return MeasurementResult{
		Config:      r.config,
		Report:      report,
		RunDuration: duration,
		StartTime:   startTime,
		EndTime:     time.Now(),
	}
}

func (r *MeasurementRunner) simulateLatency() {
	if r.config.SimulatedRTT > 0 {
		time.Sleep(r.config.SimulatedRTT / 2) // One-way latency
	}
}

// MeasurementResult contains the complete results of a measurement run.
type MeasurementResult struct {
	Config      RunConfig        `json:"config"`
	Report      RevocationReport `json:"report"`
	RunDuration time.Duration    `json:"run_duration"`
	StartTime   time.Time        `json:"start_time"`
	EndTime     time.Time        `json:"end_time"`
}

// JSON returns the result as JSON.
func (r MeasurementResult) JSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}

// WriteToFile writes the result to a JSON file.
func (r MeasurementResult) WriteToFile(path string) error {
	data, err := r.JSON()
	if err != nil {
		return fmt.Errorf("marshal result: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

// String returns a human-readable summary.
func (r MeasurementResult) String() string {
	status := "PASS"
	if !r.Report.MeetsTarget {
		status = "FAIL"
	}

	return fmt.Sprintf(`
=== Revocation Latency Measurement ===
Profile: %s
Iterations: %d
Run Duration: %v

%s
Overall: %s
`, r.Config.Profile, r.Config.Iterations, r.RunDuration, r.Report.String(), status)
}

// CompareResults compares LAN and WAN results.
func CompareResults(lan, wan MeasurementResult) string {
	return fmt.Sprintf(`
=== Revocation Latency Comparison ===

%s
%s
%s
`, formatProfileResults("LAN", lan), formatWANResults(wan), formatDelta(lan, wan))
}

func formatProfileResults(name string, r MeasurementResult) string {
	targets := r.Config.Targets()
	return fmt.Sprintf(`%s Results:
  Total P50: %v
  Total P95: %v (target: %v)
  Safe-Stop Max: %v (target: %v)
  Status: %s`,
		name, r.Report.Total.P50, r.Report.Total.P95, targets.TotalP95,
		r.Report.SafeStop.Max, targets.SafeStopMax, statusStr(r.Report.MeetsTarget))
}

func formatWANResults(r MeasurementResult) string {
	targets := r.Config.Targets()
	return fmt.Sprintf(`WAN Results (RTT: %v):
  Total P50: %v
  Total P95: %v (target: %v)
  Safe-Stop Max: %v (target: %v)
  Status: %s`,
		r.Config.SimulatedRTT, r.Report.Total.P50, r.Report.Total.P95, targets.TotalP95,
		r.Report.SafeStop.Max, targets.SafeStopMax, statusStr(r.Report.MeetsTarget))
}

func formatDelta(lan, wan MeasurementResult) string {
	return fmt.Sprintf(`Latency Delta (WAN - LAN):
  P50: +%v
  P95: +%v`,
		wan.Report.Total.P50-lan.Report.Total.P50,
		wan.Report.Total.P95-lan.Report.Total.P95)
}

func statusStr(pass bool) string {
	if pass {
		return "PASS"
	}
	return "FAIL"
}
