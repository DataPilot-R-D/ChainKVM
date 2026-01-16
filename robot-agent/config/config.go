// Package config handles Robot Agent configuration.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all Robot Agent configuration.
type Config struct {
	// Identity
	RobotID string

	// Gateway
	GatewayWSURL   string
	GatewayJWKSURL string

	// Video
	CameraDevice string
	VideoCodec   string
	VideoBitrate int
	VideoFPS     int

	// Safety
	ControlLossTimeoutMS int
	RateLimitDriveHz     int
	RateLimitKVMHz       int
	InvalidCmdThreshold  int

	// ICE
	STUNServers []string
	TURNServers []string
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{
		// Defaults
		CameraDevice:         "/dev/video0",
		VideoCodec:           "h264",
		VideoBitrate:         2000000,
		VideoFPS:             30,
		ControlLossTimeoutMS: 500,
		RateLimitDriveHz:     50,
		RateLimitKVMHz:       100,
		InvalidCmdThreshold:  10,
	}

	// Required
	cfg.RobotID = os.Getenv("ROBOT_ID")
	if cfg.RobotID == "" {
		return nil, fmt.Errorf("ROBOT_ID is required")
	}

	cfg.GatewayWSURL = os.Getenv("GATEWAY_WS_URL")
	if cfg.GatewayWSURL == "" {
		return nil, fmt.Errorf("GATEWAY_WS_URL is required")
	}

	cfg.GatewayJWKSURL = os.Getenv("GATEWAY_JWKS_URL")
	if cfg.GatewayJWKSURL == "" {
		return nil, fmt.Errorf("GATEWAY_JWKS_URL is required")
	}

	// Optional overrides
	if v := os.Getenv("CAMERA_DEVICE"); v != "" {
		cfg.CameraDevice = v
	}
	if v := os.Getenv("VIDEO_CODEC"); v != "" {
		cfg.VideoCodec = v
	}
	if v := os.Getenv("VIDEO_BITRATE"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			cfg.VideoBitrate = i
		}
	}
	if v := os.Getenv("VIDEO_FPS"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			cfg.VideoFPS = i
		}
	}
	if v := os.Getenv("CONTROL_LOSS_TIMEOUT_MS"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			cfg.ControlLossTimeoutMS = i
		}
	}
	if v := os.Getenv("RATE_LIMIT_DRIVE_HZ"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			cfg.RateLimitDriveHz = i
		}
	}
	if v := os.Getenv("RATE_LIMIT_KVM_HZ"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			cfg.RateLimitKVMHz = i
		}
	}
	if v := os.Getenv("INVALID_CMD_THRESHOLD"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			cfg.InvalidCmdThreshold = i
		}
	}

	// ICE servers
	if v := os.Getenv("STUN_SERVERS"); v != "" {
		cfg.STUNServers = strings.Split(v, ",")
	}
	if v := os.Getenv("TURN_SERVERS"); v != "" {
		cfg.TURNServers = strings.Split(v, ",")
	}

	return cfg, nil
}
