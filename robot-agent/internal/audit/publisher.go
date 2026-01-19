// Package audit provides async audit event publishing for the Robot Agent.
package audit

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// EventType identifies the type of audit event.
type EventType string

// Event types.
const (
	EventSessionRevoked EventType = "SESSION_REVOKED"
	EventSessionEnded   EventType = "SESSION_ENDED"
)

// Event represents an audit event to be published.
type Event struct {
	EventType   EventType         `json:"event_type"`
	SessionID   string            `json:"session_id"`
	RobotID     string            `json:"robot_id"`
	OperatorDID string            `json:"operator_did,omitempty"`
	Timestamp   time.Time         `json:"timestamp"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// HTTPClient interface for HTTP operations (allows mocking).
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

const defaultTimeout = 5 * time.Second

// Publisher publishes audit events to the gateway.
type Publisher struct {
	gatewayURL string
	robotID    string
	client     HTTPClient
}

// NewPublisher creates a new audit event publisher.
func NewPublisher(gatewayURL, robotID string) *Publisher {
	return &Publisher{
		gatewayURL: gatewayURL,
		robotID:    robotID,
		client:     &http.Client{Timeout: defaultTimeout},
	}
}

// SetHTTPClient allows setting a custom HTTP client (for testing).
func (p *Publisher) SetHTTPClient(client HTTPClient) {
	p.client = client
}

// Publish sends an audit event to the gateway (async, fire-and-forget).
// Errors are logged but not returned since this is non-blocking.
func (p *Publisher) Publish(event Event) {
	go func() {
		if err := p.publishAsync(event); err != nil {
			log.Printf("audit: failed to publish event %s: %v", event.EventType, err)
		}
	}()
}

// PublishSync sends an audit event synchronously (for testing).
func (p *Publisher) PublishSync(event Event) error {
	return p.publishAsync(event)
}

func (p *Publisher) publishAsync(event Event) error {
	if event.RobotID == "" {
		event.RobotID = p.robotID
	}

	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	url := fmt.Sprintf("%s/v1/audit", p.gatewayURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("audit publish failed: status %d", resp.StatusCode)
	}

	return nil
}
