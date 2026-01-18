// Package control provides a stub RobotAPI for POC testing.
package control

import "go.uber.org/zap"

// StubRobotAPI is a no-op robot API for POC testing.
type StubRobotAPI struct {
	logger *zap.Logger
}

// NewStubRobotAPI creates a new stub robot API.
func NewStubRobotAPI(logger *zap.Logger) *StubRobotAPI {
	return &StubRobotAPI{logger: logger}
}

// Drive logs drive command (no-op for POC).
func (s *StubRobotAPI) Drive(v, w float64) error {
	s.logger.Debug("drive command", zap.Float64("v", v), zap.Float64("w", w))
	return nil
}

// SendKey logs key command (no-op for POC).
func (s *StubRobotAPI) SendKey(key, action string, modifiers []string) error {
	s.logger.Debug("key command",
		zap.String("key", key),
		zap.String("action", action),
		zap.Strings("modifiers", modifiers))
	return nil
}

// SendMouse logs mouse command (no-op for POC).
func (s *StubRobotAPI) SendMouse(dx, dy, buttons, scroll int) error {
	s.logger.Debug("mouse command",
		zap.Int("dx", dx),
		zap.Int("dy", dy),
		zap.Int("buttons", buttons),
		zap.Int("scroll", scroll))
	return nil
}

// EStop logs emergency stop (no-op for POC).
func (s *StubRobotAPI) EStop() error {
	s.logger.Warn("emergency stop triggered")
	return nil
}
