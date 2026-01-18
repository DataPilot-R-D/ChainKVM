// Package transport implements WebRTC transport for the Robot Agent.
package transport

import (
	"encoding/json"
	"errors"
	"sync"

	"github.com/pion/webrtc/v3"
	"go.uber.org/zap"
)

// Error definitions.
var (
	ErrNoPeerConnection = errors.New("no peer connection")
	ErrNoDataChannel    = errors.New("no data channel")
)

// DataChannelHandler processes incoming DataChannel messages.
type DataChannelHandler func(data []byte)

// ICECandidate represents a serialized ICE candidate.
type ICECandidate struct {
	Candidate        string  `json:"candidate"`
	SDPMid           string  `json:"sdpMid"`
	SDPMLineIndex    uint16  `json:"sdpMLineIndex"`
	UsernameFragment *string `json:"usernameFragment,omitempty"`
}

// ICEConfig holds ICE server configuration.
type ICEConfig struct {
	STUNServers []string
	TURNServers []string
}

// WebRTC manages WebRTC peer connection.
type WebRTC struct {
	mu     sync.Mutex
	logger *zap.Logger

	config ICEConfig
	pc     *webrtc.PeerConnection
	dc     *webrtc.DataChannel

	onICE          func(candidate []byte)
	onDataMessage  DataChannelHandler
	onStateChange  func(state webrtc.PeerConnectionState)
}

// NewWebRTC creates a new WebRTC transport.
func NewWebRTC(config ICEConfig, logger *zap.Logger) *WebRTC {
	return &WebRTC{
		config: config,
		logger: logger,
	}
}

// SetICECallback sets the callback for ICE candidates.
func (w *WebRTC) SetICECallback(fn func(candidate []byte)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.onICE = fn
}

// SetDataHandler sets the handler for DataChannel messages.
func (w *WebRTC) SetDataHandler(fn DataChannelHandler) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.onDataMessage = fn
}

// SetStateCallback sets the callback for connection state changes.
func (w *WebRTC) SetStateCallback(fn func(webrtc.PeerConnectionState)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.onStateChange = fn
}

// CreatePeerConnection initializes a new WebRTC peer connection.
func (w *WebRTC) CreatePeerConnection() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	// Build ICE server list
	iceServers := []webrtc.ICEServer{}

	if len(w.config.STUNServers) > 0 {
		iceServers = append(iceServers, webrtc.ICEServer{
			URLs: w.config.STUNServers,
		})
	}

	if len(w.config.TURNServers) > 0 {
		iceServers = append(iceServers, webrtc.ICEServer{
			URLs: w.config.TURNServers,
		})
	}

	// Default STUN if none configured
	if len(iceServers) == 0 {
		iceServers = append(iceServers, webrtc.ICEServer{
			URLs: []string{"stun:stun.l.google.com:19302"},
		})
	}

	config := webrtc.Configuration{
		ICEServers: iceServers,
	}

	pc, err := webrtc.NewPeerConnection(config)
	if err != nil {
		return err
	}

	// Set up ICE candidate handler
	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}

		w.mu.Lock()
		onICE := w.onICE
		w.mu.Unlock()

		if onICE != nil {
			cInit := c.ToJSON()
			candidate := ICECandidate{
				Candidate:        cInit.Candidate,
				SDPMid:           *cInit.SDPMid,
				SDPMLineIndex:    *cInit.SDPMLineIndex,
				UsernameFragment: cInit.UsernameFragment,
			}
			candidateData, _ := json.Marshal(candidate)
			onICE(candidateData)
		}
	})

	// Set up connection state handler
	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		w.logger.Info("connection state changed", zap.String("state", state.String()))

		w.mu.Lock()
		onStateChange := w.onStateChange
		w.mu.Unlock()

		if onStateChange != nil {
			onStateChange(state)
		}
	})

	// Set up DataChannel handler (for incoming channels)
	pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		w.logger.Info("data channel opened", zap.String("label", dc.Label()))

		w.mu.Lock()
		w.dc = dc
		onDataMessage := w.onDataMessage
		w.mu.Unlock()

		dc.OnMessage(func(msg webrtc.DataChannelMessage) {
			if onDataMessage != nil {
				onDataMessage(msg.Data)
			}
		})
	})

	w.pc = pc
	return nil
}

// HandleOffer processes an SDP offer and generates an answer.
func (w *WebRTC) HandleOffer(sdpData []byte) ([]byte, error) {
	w.mu.Lock()
	pc := w.pc
	w.mu.Unlock()

	if pc == nil {
		return nil, ErrNoPeerConnection
	}

	var offer webrtc.SessionDescription
	if err := json.Unmarshal(sdpData, &offer); err != nil {
		return nil, err
	}

	if err := pc.SetRemoteDescription(offer); err != nil {
		return nil, err
	}

	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		return nil, err
	}

	if err := pc.SetLocalDescription(answer); err != nil {
		return nil, err
	}

	return json.Marshal(answer)
}

// AddICECandidate adds a remote ICE candidate.
func (w *WebRTC) AddICECandidate(candidateData []byte) error {
	w.mu.Lock()
	pc := w.pc
	w.mu.Unlock()

	if pc == nil {
		return ErrNoPeerConnection
	}

	var candidate ICECandidate
	if err := json.Unmarshal(candidateData, &candidate); err != nil {
		return err
	}

	return pc.AddICECandidate(webrtc.ICECandidateInit{
		Candidate:        candidate.Candidate,
		SDPMid:           &candidate.SDPMid,
		SDPMLineIndex:    &candidate.SDPMLineIndex,
		UsernameFragment: candidate.UsernameFragment,
	})
}

// SendData sends a message via the DataChannel.
func (w *WebRTC) SendData(data []byte) error {
	w.mu.Lock()
	dc := w.dc
	w.mu.Unlock()

	if dc == nil {
		return ErrNoDataChannel
	}

	return dc.Send(data)
}

// Close closes the peer connection.
func (w *WebRTC) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.pc != nil {
		err := w.pc.Close()
		w.pc = nil
		w.dc = nil
		return err
	}
	return nil
}

// State returns the current connection state.
func (w *WebRTC) State() webrtc.PeerConnectionState {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.pc == nil {
		return webrtc.PeerConnectionStateClosed
	}
	return w.pc.ConnectionState()
}
