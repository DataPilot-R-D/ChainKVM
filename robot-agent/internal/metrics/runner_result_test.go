package metrics

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestMeasurementResult_JSON(t *testing.T) {
	result := MeasurementResult{
		Config: DefaultLANConfig(),
		Report: RevocationReport{
			SampleCount: 10,
			MeetsTarget: true,
		},
		RunDuration: 1 * time.Second,
		StartTime:   time.Now(),
		EndTime:     time.Now(),
	}

	data, err := result.JSON()
	if err != nil {
		t.Fatalf("JSON() error: %v", err)
	}

	if len(data) == 0 {
		t.Error("JSON output should not be empty")
	}
}

func TestMeasurementResult_WriteToFile(t *testing.T) {
	result := MeasurementResult{
		Config: DefaultLANConfig(),
		Report: RevocationReport{
			SampleCount: 10,
			MeetsTarget: true,
		},
		RunDuration: 1 * time.Second,
		StartTime:   time.Now(),
		EndTime:     time.Now(),
	}

	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "result.json")

	err := result.WriteToFile(path)
	if err != nil {
		t.Fatalf("WriteToFile error: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read file error: %v", err)
	}
	if len(data) == 0 {
		t.Error("output file should not be empty")
	}
}

func TestMeasurementResult_String(t *testing.T) {
	result := MeasurementResult{
		Config: DefaultLANConfig(),
		Report: RevocationReport{
			SampleCount: 10,
			MeetsTarget: true,
		},
		RunDuration: 1 * time.Second,
	}

	str := result.String()

	if len(str) == 0 {
		t.Error("String() should not be empty")
	}

	if !strings.Contains(str, "lan") {
		t.Error("String() should contain profile")
	}
	if !strings.Contains(str, "PASS") {
		t.Error("String() should contain PASS for passing result")
	}
}

func TestCompareResults(t *testing.T) {
	lan := MeasurementResult{
		Config: DefaultLANConfig(),
		Report: RevocationReport{
			Total:       RevocationStats{P50: 50 * time.Millisecond, P95: 100 * time.Millisecond},
			SafeStop:    RevocationStats{Max: 20 * time.Millisecond},
			MeetsTarget: true,
		},
	}

	wan := MeasurementResult{
		Config: DefaultWANConfig(),
		Report: RevocationReport{
			Total:       RevocationStats{P50: 150 * time.Millisecond, P95: 300 * time.Millisecond},
			SafeStop:    RevocationStats{Max: 25 * time.Millisecond},
			MeetsTarget: true,
		},
	}

	comparison := CompareResults(lan, wan)

	if len(comparison) == 0 {
		t.Error("comparison should not be empty")
	}
	if !strings.Contains(comparison, "LAN Results") {
		t.Error("comparison should contain LAN section")
	}
	if !strings.Contains(comparison, "WAN Results") {
		t.Error("comparison should contain WAN section")
	}
	if !strings.Contains(comparison, "Delta") {
		t.Error("comparison should contain Delta section")
	}
}
