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
	GatewayHTTPURL string
	GatewayJWKSURL string

	// Video
	CameraDevice string
	VideoCodec   string
	VideoBitrate int
	VideoFPS     int

	// Safety
	ControlLossTimeoutMS   int
	RateLimitDriveHz       int
	RateLimitKVMHz         int
	InvalidCmdThreshold    int
	InvalidCmdTimeWindowMS int

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
		ControlLossTimeoutMS:   500,
		RateLimitDriveHz:       50,
		RateLimitKVMHz:         100,
		InvalidCmdThreshold:    10,
		InvalidCmdTimeWindowMS: 30000,
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

	// Gateway HTTP URL for audit events (optional, derived from WS URL)
	cfg.GatewayHTTPURL = os.Getenv("GATEWAY_HTTP_URL")
	if cfg.GatewayHTTPURL == "" {
		cfg.GatewayHTTPURL = deriveHTTPURL(cfg.GatewayWSURL)
	}

	// Optional string overrides
	if v := os.Getenv("CAMERA_DEVICE"); v != "" {
		cfg.CameraDevice = v
	}
	if v := os.Getenv("VIDEO_CODEC"); v != "" {
		cfg.VideoCodec = v
	}

	// Optional int overrides
	cfg.VideoBitrate = envInt("VIDEO_BITRATE", cfg.VideoBitrate)
	cfg.VideoFPS = envInt("VIDEO_FPS", cfg.VideoFPS)
	cfg.ControlLossTimeoutMS = envInt("CONTROL_LOSS_TIMEOUT_MS", cfg.ControlLossTimeoutMS)
	cfg.RateLimitDriveHz = envInt("RATE_LIMIT_DRIVE_HZ", cfg.RateLimitDriveHz)
	cfg.RateLimitKVMHz = envInt("RATE_LIMIT_KVM_HZ", cfg.RateLimitKVMHz)
	cfg.InvalidCmdThreshold = envInt("INVALID_CMD_THRESHOLD", cfg.InvalidCmdThreshold)
	cfg.InvalidCmdTimeWindowMS = envInt("INVALID_CMD_TIME_WINDOW_MS", cfg.InvalidCmdTimeWindowMS)

	// ICE servers
	if v := os.Getenv("STUN_SERVERS"); v != "" {
		cfg.STUNServers = strings.Split(v, ",")
	}
	if v := os.Getenv("TURN_SERVERS"); v != "" {
		cfg.TURNServers = strings.Split(v, ",")
	}

	return cfg, nil
}

// envInt returns the env var as int, or the default if unset or invalid.
func envInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultVal
}

// deriveHTTPURL converts ws://host:port/path to http://host:port.
func deriveHTTPURL(wsURL string) string {
	httpURL := strings.Replace(wsURL, "wss://", "https://", 1)
	httpURL = strings.Replace(httpURL, "ws://", "http://", 1)

	// Remove path component (e.g., /v1/signal)
	if schemeEnd := strings.Index(httpURL, "://"); schemeEnd != -1 {
		hostStart := schemeEnd + 3
		if pathIdx := strings.Index(httpURL[hostStart:], "/"); pathIdx != -1 {
			return httpURL[:hostStart+pathIdx]
		}
	}
	return httpURL
}
