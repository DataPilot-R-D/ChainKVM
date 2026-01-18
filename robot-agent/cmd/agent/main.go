// Package main is the entry point for the Robot Agent.
package main

import (
	"context"
	"encoding/json"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/pion/webrtc/v3"
	"go.uber.org/zap"

	"github.com/datapilot/chainkvm/robot-agent/config"
	"github.com/datapilot/chainkvm/robot-agent/internal/control"
	"github.com/datapilot/chainkvm/robot-agent/internal/safety"
	"github.com/datapilot/chainkvm/robot-agent/internal/session"
	"github.com/datapilot/chainkvm/robot-agent/internal/transport"
	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
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

// OnOffer handles incoming SDP offer from console.
func (a *agent) OnOffer(sessionID string, sdpData []byte) {
	a.logger.Info("received offer", zap.String("session_id", sessionID))

	if err := a.transport.CreatePeerConnection(); err != nil {
		a.logger.Error("failed to create peer connection", zap.Error(err))
		return
	}

	a.transport.SetICECallback(func(candidate []byte) {
		if err := a.signaling.SendICE(sessionID, candidate); err != nil {
			a.logger.Warn("failed to send ICE candidate", zap.Error(err))
		}
	})

	a.transport.SetDataHandler(a.onDataMessage)

	a.transport.SetStateCallback(func(state webrtc.PeerConnectionState) {
		switch state {
		case webrtc.PeerConnectionStateConnected:
			a.sessionMgr.Activate(&session.Info{
				SessionID: sessionID,
				RobotID:   a.cfg.RobotID,
			})
			a.safety.Reset()
		case webrtc.PeerConnectionStateFailed, webrtc.PeerConnectionStateClosed:
			a.sessionMgr.Terminate()
		}
	})

	answer, err := a.transport.HandleOffer(sdpData)
	if err != nil {
		a.logger.Error("failed to handle offer", zap.Error(err))
		return
	}

	if err := a.signaling.SendAnswer(sessionID, answer); err != nil {
		a.logger.Error("failed to send answer", zap.Error(err))
	}
}

// OnAnswer handles SDP answer (robot is always answerer).
func (a *agent) OnAnswer(sessionID string, sdp []byte) {
	a.logger.Warn("unexpected answer received", zap.String("session_id", sessionID))
}

// OnICE handles incoming ICE candidate.
func (a *agent) OnICE(sessionID string, candidate []byte) {
	if err := a.transport.AddICECandidate(candidate); err != nil {
		a.logger.Warn("failed to add ICE candidate", zap.Error(err))
	}
}

// OnBye handles session termination from gateway.
func (a *agent) OnBye(sessionID string) {
	a.logger.Info("received bye", zap.String("session_id", sessionID))
	a.safety.OnRevoked()
}

func (a *agent) onDataMessage(data []byte) {
	ack, err := a.handler.HandleMessage(data)
	if err != nil {
		a.logger.Debug("message handling error", zap.Error(err))
		return
	}

	if ack != nil {
		ackData, _ := json.Marshal(ack)
		if err := a.transport.SendData(ackData); err != nil {
			a.logger.Warn("failed to send ack", zap.Error(err))
		}
	}
}

func (a *agent) onSafeStop(trigger safety.Trigger) {
	a.logger.Warn("safe-stop triggered", zap.String("trigger", string(trigger)))

	stateMsg := protocol.StateMessage{
		Type:         protocol.TypeState,
		RobotState:   protocol.RobotStateSafeStop,
		SessionState: "safe_stop",
		T:            time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(stateMsg)
	_ = a.transport.SendData(data)
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
