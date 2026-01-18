// Package main is the entry point for the Robot Agent.
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"github.com/datapilot/chainkvm/robot-agent/config"
	"github.com/datapilot/chainkvm/robot-agent/internal/control"
	"github.com/datapilot/chainkvm/robot-agent/internal/safety"
	"github.com/datapilot/chainkvm/robot-agent/internal/session"
	"github.com/datapilot/chainkvm/robot-agent/internal/transport"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	logger.Info("starting robot agent", zap.String("robot_id", cfg.RobotID))

	agent := newAgent(cfg, logger)
	if err := agent.run(ctx); err != nil {
		logger.Fatal("agent failed", zap.Error(err))
	}
}

// agent coordinates all Robot Agent components.
type agent struct {
	cfg    *config.Config
	logger *zap.Logger

	sessionMgr *session.Manager
	signaling  *session.SignalingClient
	transport  *transport.WebRTC
	safety     *safety.Monitor
	handler *control.Handler
}

func newAgent(cfg *config.Config, logger *zap.Logger) *agent {
	return &agent{
		cfg:    cfg,
		logger: logger,
	}
}

func (a *agent) run(ctx context.Context) error {
	a.initComponents()

	go func() {
		if err := a.signaling.Connect(ctx); err != nil {
			a.logger.Error("signaling connection failed", zap.Error(err))
		}
	}()

	go a.runSafetyMonitor(ctx)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		a.logger.Info("received signal, shutting down", zap.String("signal", sig.String()))
	case <-ctx.Done():
		a.logger.Info("context cancelled, shutting down")
	case <-a.signaling.Done():
		a.logger.Info("signaling connection closed")
	}

	return a.shutdown()
}

func (a *agent) initComponents() {
	tokenValidator := a.initTokenValidator()

	a.sessionMgr = session.NewManager(a.cfg.RobotID, tokenValidator)
	a.sessionMgr.SetStateChangeCallback(func(state session.State) {
		a.logger.Info("session state changed", zap.String("state", string(state)))
	})

	timeout := time.Duration(a.cfg.ControlLossTimeoutMS) * time.Millisecond
	a.safety = safety.NewMonitor(timeout, a.cfg.InvalidCmdThreshold, a.onSafeStop)

	robotAPI := control.NewStubRobotAPI(a.logger)
	staleThreshold := 200 * time.Millisecond
	a.handler = control.NewHandler(robotAPI, a.safety, a.sessionMgr, staleThreshold)

	iceConfig := transport.ICEConfig{
		STUNServers: a.cfg.STUNServers,
		TURNServers: a.cfg.TURNServers,
	}
	a.transport = transport.NewWebRTC(iceConfig, a.logger)
	a.signaling = session.NewSignalingClient(a.cfg.GatewayWSURL, a.cfg.RobotID, a.logger)
	a.signaling.SetHandler(a)

	a.logger.Info("components initialized")
}

func (a *agent) initTokenValidator() *session.TokenValidator {
	jwksFetcher := session.NewJWKSFetcher(a.cfg.GatewayJWKSURL, 5*time.Minute)
	if err := jwksFetcher.Refresh(); err != nil {
		a.logger.Warn("initial JWKS fetch failed", zap.Error(err))
	}

	pub, err := jwksFetcher.GetPublicKey("gateway-signing-key")
	if err != nil {
		a.logger.Warn("token validator not initialized", zap.Error(err))
		return nil
	}

	return session.NewTokenValidator(pub, a.cfg.RobotID, 30*time.Second)
}

func (a *agent) runSafetyMonitor(ctx context.Context) {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if a.sessionMgr.State() == session.StateActive {
				a.safety.CheckControlLoss()
			}
		}
	}
}

func (a *agent) shutdown() error {
	a.logger.Info("initiating graceful shutdown")

	a.safety.OnRevoked()

	if err := a.transport.Close(); err != nil {
		a.logger.Warn("error closing transport", zap.Error(err))
	}

	if err := a.signaling.Close(); err != nil {
		a.logger.Warn("error closing signaling", zap.Error(err))
	}

	a.logger.Info("shutdown complete")
	return nil
}
