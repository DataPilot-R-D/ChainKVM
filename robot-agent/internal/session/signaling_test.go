package session

import (
	"testing"
)

func TestSignalTypes(t *testing.T) {
	t.Run("SignalRevoked constant has correct value", func(t *testing.T) {
		if SignalRevoked != "revoked" {
			t.Errorf("SignalRevoked = %q, want %q", SignalRevoked, "revoked")
		}
	})

	t.Run("All signal types are distinct", func(t *testing.T) {
		types := []SignalType{
			SignalJoin,
			SignalOffer,
			SignalAnswer,
			SignalICE,
			SignalBye,
			SignalError,
			SignalRevoked,
		}

		seen := make(map[SignalType]bool)
		for _, st := range types {
			if seen[st] {
				t.Errorf("Duplicate signal type: %q", st)
			}
			seen[st] = true
		}
	})
}

func TestSignalMessageReason(t *testing.T) {
	t.Run("SignalMessage has Reason field", func(t *testing.T) {
		msg := SignalMessage{
			Type:      SignalRevoked,
			SessionID: "ses_123",
			Reason:    "Admin revoked session",
		}

		if msg.Reason != "Admin revoked session" {
			t.Errorf("Reason = %q, want %q", msg.Reason, "Admin revoked session")
		}
	})
}

// MockSignalingHandler implements SignalingHandler for testing.
type MockSignalingHandler struct {
	OfferCalls   []struct{ SessionID, Token string; SDP []byte }
	AnswerCalls  []struct{ SessionID string; SDP []byte }
	ICECalls     []struct{ SessionID string; Candidate []byte }
	ByeCalls     []string
	RevokedCalls []struct{ SessionID, Reason string }
}

func (m *MockSignalingHandler) OnOffer(sessionID, token string, sdp []byte) {
	m.OfferCalls = append(m.OfferCalls, struct {
		SessionID string
		Token     string
		SDP       []byte
	}{sessionID, token, sdp})
}

func (m *MockSignalingHandler) OnAnswer(sessionID string, sdp []byte) {
	m.AnswerCalls = append(m.AnswerCalls, struct {
		SessionID string
		SDP       []byte
	}{sessionID, sdp})
}

func (m *MockSignalingHandler) OnICE(sessionID string, candidate []byte) {
	m.ICECalls = append(m.ICECalls, struct {
		SessionID string
		Candidate []byte
	}{sessionID, candidate})
}

func (m *MockSignalingHandler) OnBye(sessionID string) {
	m.ByeCalls = append(m.ByeCalls, sessionID)
}

func (m *MockSignalingHandler) OnRevoked(sessionID, reason string) {
	m.RevokedCalls = append(m.RevokedCalls, struct {
		SessionID string
		Reason    string
	}{sessionID, reason})
}

func TestSignalingHandlerInterface(t *testing.T) {
	t.Run("MockSignalingHandler implements SignalingHandler", func(t *testing.T) {
		var _ SignalingHandler = (*MockSignalingHandler)(nil)
	})

	t.Run("OnRevoked is callable", func(t *testing.T) {
		handler := &MockSignalingHandler{}
		handler.OnRevoked("ses_123", "test reason")

		if len(handler.RevokedCalls) != 1 {
			t.Fatalf("Expected 1 revoked call, got %d", len(handler.RevokedCalls))
		}

		if handler.RevokedCalls[0].SessionID != "ses_123" {
			t.Errorf("SessionID = %q, want %q", handler.RevokedCalls[0].SessionID, "ses_123")
		}

		if handler.RevokedCalls[0].Reason != "test reason" {
			t.Errorf("Reason = %q, want %q", handler.RevokedCalls[0].Reason, "test reason")
		}
	})
}
