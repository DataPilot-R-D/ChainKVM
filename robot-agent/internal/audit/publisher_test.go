package audit

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"
)

// mockHTTPClient captures HTTP requests for testing.
type mockHTTPClient struct {
	requests   []*http.Request
	bodies     [][]byte
	statusCode int
	err        error
}

func (m *mockHTTPClient) Do(req *http.Request) (*http.Response, error) {
	if m.err != nil {
		return nil, m.err
	}

	// Capture request
	m.requests = append(m.requests, req)

	// Read and capture body
	if req.Body != nil {
		body, _ := io.ReadAll(req.Body)
		m.bodies = append(m.bodies, body)
	}

	return &http.Response{
		StatusCode: m.statusCode,
		Body:       io.NopCloser(bytes.NewReader(nil)),
	}, nil
}

func TestPublisher_PublishSync(t *testing.T) {
	client := &mockHTTPClient{statusCode: 200}
	publisher := NewPublisher("http://gateway:8080", "robot_123")
	publisher.SetHTTPClient(client)

	event := Event{
		EventType: EventSessionRevoked,
		SessionID: "ses_abc",
		Timestamp: time.Now().UTC(),
		Metadata:  map[string]string{"reason": "Admin revoked"},
	}

	err := publisher.PublishSync(event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(client.requests) != 1 {
		t.Fatalf("expected 1 request, got %d", len(client.requests))
	}

	req := client.requests[0]
	if req.Method != http.MethodPost {
		t.Errorf("expected POST, got %s", req.Method)
	}

	if req.URL.String() != "http://gateway:8080/v1/audit" {
		t.Errorf("unexpected URL: %s", req.URL.String())
	}

	if req.Header.Get("Content-Type") != "application/json" {
		t.Errorf("expected application/json content type")
	}
}

func TestPublisher_EventPayload(t *testing.T) {
	client := &mockHTTPClient{statusCode: 200}
	publisher := NewPublisher("http://gateway:8080", "robot_123")
	publisher.SetHTTPClient(client)

	event := Event{
		EventType:   EventSessionRevoked,
		SessionID:   "ses_abc",
		OperatorDID: "did:key:z123",
		Timestamp:   time.Date(2026, 1, 19, 12, 0, 0, 0, time.UTC),
		Metadata:    map[string]string{"reason": "Policy violation"},
	}

	err := publisher.PublishSync(event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var payload Event
	if err := json.Unmarshal(client.bodies[0], &payload); err != nil {
		t.Fatalf("failed to unmarshal payload: %v", err)
	}

	if payload.EventType != EventSessionRevoked {
		t.Errorf("expected SESSION_REVOKED, got %s", payload.EventType)
	}

	if payload.SessionID != "ses_abc" {
		t.Errorf("expected ses_abc, got %s", payload.SessionID)
	}

	if payload.RobotID != "robot_123" {
		t.Errorf("expected robot_123, got %s", payload.RobotID)
	}

	if payload.OperatorDID != "did:key:z123" {
		t.Errorf("expected did:key:z123, got %s", payload.OperatorDID)
	}

	if payload.Metadata["reason"] != "Policy violation" {
		t.Errorf("expected 'Policy violation', got %s", payload.Metadata["reason"])
	}
}

func TestPublisher_SetsRobotIDFromPublisher(t *testing.T) {
	client := &mockHTTPClient{statusCode: 200}
	publisher := NewPublisher("http://gateway:8080", "default_robot")
	publisher.SetHTTPClient(client)

	// Event without robot ID
	event := Event{
		EventType: EventSessionRevoked,
		SessionID: "ses_abc",
		Timestamp: time.Now().UTC(),
	}

	err := publisher.PublishSync(event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var payload Event
	if err := json.Unmarshal(client.bodies[0], &payload); err != nil {
		t.Fatalf("failed to unmarshal payload: %v", err)
	}

	if payload.RobotID != "default_robot" {
		t.Errorf("expected default_robot, got %s", payload.RobotID)
	}
}

func TestPublisher_HTTPError(t *testing.T) {
	client := &mockHTTPClient{statusCode: 500}
	publisher := NewPublisher("http://gateway:8080", "robot_123")
	publisher.SetHTTPClient(client)

	event := Event{
		EventType: EventSessionRevoked,
		SessionID: "ses_abc",
		Timestamp: time.Now().UTC(),
	}

	err := publisher.PublishSync(event)
	if err == nil {
		t.Error("expected error for 500 status")
	}
}

func TestPublisher_NetworkError(t *testing.T) {
	client := &mockHTTPClient{err: io.EOF}
	publisher := NewPublisher("http://gateway:8080", "robot_123")
	publisher.SetHTTPClient(client)

	event := Event{
		EventType: EventSessionRevoked,
		SessionID: "ses_abc",
		Timestamp: time.Now().UTC(),
	}

	err := publisher.PublishSync(event)
	if err == nil {
		t.Error("expected error for network failure")
	}
}
