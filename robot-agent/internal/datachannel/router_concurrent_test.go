package datachannel

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

func TestRouter_HighMessageRate(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	var count int
	var mu sync.Mutex
	r.RegisterHandler(protocol.TypeDrive, func(data []byte) ([]byte, error) {
		mu.Lock()
		count++
		mu.Unlock()
		return nil, nil
	})

	// Send 1000 messages
	for i := range 1000 {
		msg := protocol.DriveMessage{
			Type: protocol.TypeDrive,
			V:    float64(i) / 1000,
			W:    0,
			T:    time.Now().UnixMilli(),
		}
		data, _ := json.Marshal(msg)
		err := r.HandleMessage(data)
		if err != nil {
			t.Fatalf("error at message %d: %v", i, err)
		}
	}

	mu.Lock()
	if count != 1000 {
		t.Errorf("expected 1000 messages processed, got %d", count)
	}
	mu.Unlock()
}

func TestRouter_ConcurrentHandlers(t *testing.T) {
	sender := &mockSender{}
	r := NewRouter(sender)

	var driveCount, keyCount int
	var mu sync.Mutex

	r.RegisterHandler(protocol.TypeDrive, func(data []byte) ([]byte, error) {
		mu.Lock()
		driveCount++
		mu.Unlock()
		return nil, nil
	})

	r.RegisterHandler(protocol.TypeKVMKey, func(data []byte) ([]byte, error) {
		mu.Lock()
		keyCount++
		mu.Unlock()
		return nil, nil
	})

	var wg sync.WaitGroup
	for range 100 {
		wg.Add(2)
		go func() {
			defer wg.Done()
			msg := protocol.DriveMessage{
				Type: protocol.TypeDrive,
				V:    0.5,
				W:    0.3,
				T:    time.Now().UnixMilli(),
			}
			data, _ := json.Marshal(msg)
			r.HandleMessage(data)
		}()
		go func() {
			defer wg.Done()
			msg := protocol.KVMKeyMessage{
				Type:   protocol.TypeKVMKey,
				Key:    "KeyA",
				Action: "down",
				T:      time.Now().UnixMilli(),
			}
			data, _ := json.Marshal(msg)
			r.HandleMessage(data)
		}()
	}
	wg.Wait()

	mu.Lock()
	defer mu.Unlock()
	if driveCount != 100 {
		t.Errorf("expected 100 drive messages, got %d", driveCount)
	}
	if keyCount != 100 {
		t.Errorf("expected 100 key messages, got %d", keyCount)
	}
}
