package control

import (
	"testing"
	"time"

	"github.com/datapilot/chainkvm/robot-agent/pkg/protocol"
)

func TestValidator_ValidateDrive(t *testing.T) {
	v := NewValidator(500 * time.Millisecond)
	now := time.Now().UnixMilli()

	tests := []struct {
		name    string
		msg     *protocol.DriveMessage
		wantErr bool
		errCode string
	}{
		{
			name:    "valid drive command",
			msg:     &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.5, W: 0.3, T: now},
			wantErr: false,
		},
		{
			name:    "valid zero velocity",
			msg:     &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0, W: 0, T: now},
			wantErr: false,
		},
		{
			name:    "valid max velocity",
			msg:     &protocol.DriveMessage{Type: protocol.TypeDrive, V: 1.0, W: 1.0, T: now},
			wantErr: false,
		},
		{
			name:    "valid negative velocity",
			msg:     &protocol.DriveMessage{Type: protocol.TypeDrive, V: -1.0, W: -1.0, T: now},
			wantErr: false,
		},
		{
			name:    "invalid v out of range high",
			msg:     &protocol.DriveMessage{Type: protocol.TypeDrive, V: 1.5, W: 0, T: now},
			wantErr: true,
			errCode: ErrOutOfRange,
		},
		{
			name:    "invalid v out of range low",
			msg:     &protocol.DriveMessage{Type: protocol.TypeDrive, V: -1.5, W: 0, T: now},
			wantErr: true,
			errCode: ErrOutOfRange,
		},
		{
			name:    "invalid w out of range",
			msg:     &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0, W: 2.0, T: now},
			wantErr: true,
			errCode: ErrOutOfRange,
		},
		{
			name:    "stale command",
			msg:     &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.5, W: 0, T: now - 1000},
			wantErr: true,
			errCode: ErrStaleCommand,
		},
		{
			name:    "zero timestamp",
			msg:     &protocol.DriveMessage{Type: protocol.TypeDrive, V: 0.5, W: 0, T: 0},
			wantErr: true,
			errCode: ErrInvalidTimestamp,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := v.ValidateDrive(tt.msg)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
					return
				}
				ve, ok := err.(*ValidationError)
				if !ok {
					t.Errorf("expected ValidationError, got %T", err)
					return
				}
				if ve.Code != tt.errCode {
					t.Errorf("expected code %s, got %s", tt.errCode, ve.Code)
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestValidator_ValidateKVMKey(t *testing.T) {
	v := NewValidator(500 * time.Millisecond)
	now := time.Now().UnixMilli()

	tests := []struct {
		name    string
		msg     *protocol.KVMKeyMessage
		wantErr bool
		errCode string
	}{
		{
			name:    "valid key down",
			msg:     &protocol.KVMKeyMessage{Type: protocol.TypeKVMKey, Key: "KeyA", Action: "down", T: now},
			wantErr: false,
		},
		{
			name:    "valid key up",
			msg:     &protocol.KVMKeyMessage{Type: protocol.TypeKVMKey, Key: "Enter", Action: "up", T: now},
			wantErr: false,
		},
		{
			name:    "valid with modifiers",
			msg:     &protocol.KVMKeyMessage{Type: protocol.TypeKVMKey, Key: "KeyC", Action: "down", Modifiers: []string{"ctrl"}, T: now},
			wantErr: false,
		},
		{
			name:    "empty key",
			msg:     &protocol.KVMKeyMessage{Type: protocol.TypeKVMKey, Key: "", Action: "down", T: now},
			wantErr: true,
			errCode: ErrMissingField,
		},
		{
			name:    "invalid action",
			msg:     &protocol.KVMKeyMessage{Type: protocol.TypeKVMKey, Key: "KeyA", Action: "press", T: now},
			wantErr: true,
			errCode: ErrInvalidValue,
		},
		{
			name:    "stale command",
			msg:     &protocol.KVMKeyMessage{Type: protocol.TypeKVMKey, Key: "KeyA", Action: "down", T: now - 1000},
			wantErr: true,
			errCode: ErrStaleCommand,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := v.ValidateKVMKey(tt.msg)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
					return
				}
				ve, ok := err.(*ValidationError)
				if !ok {
					t.Errorf("expected ValidationError, got %T", err)
					return
				}
				if ve.Code != tt.errCode {
					t.Errorf("expected code %s, got %s", tt.errCode, ve.Code)
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestValidator_ValidateKVMMouse(t *testing.T) {
	v := NewValidator(500 * time.Millisecond)
	now := time.Now().UnixMilli()

	tests := []struct {
		name    string
		msg     *protocol.KVMMouseMessage
		wantErr bool
		errCode string
	}{
		{
			name:    "valid mouse move",
			msg:     &protocol.KVMMouseMessage{Type: protocol.TypeKVMMouse, DX: 10, DY: -5, Buttons: 0, T: now},
			wantErr: false,
		},
		{
			name:    "valid mouse click",
			msg:     &protocol.KVMMouseMessage{Type: protocol.TypeKVMMouse, DX: 0, DY: 0, Buttons: 1, T: now},
			wantErr: false,
		},
		{
			name:    "valid scroll",
			msg:     &protocol.KVMMouseMessage{Type: protocol.TypeKVMMouse, DX: 0, DY: 0, Buttons: 0, Scroll: 3, T: now},
			wantErr: false,
		},
		{
			name:    "excessive movement clamped (no error)",
			msg:     &protocol.KVMMouseMessage{Type: protocol.TypeKVMMouse, DX: 10000, DY: 10000, Buttons: 0, T: now},
			wantErr: false, // Will be clamped, not rejected
		},
		{
			name:    "stale command",
			msg:     &protocol.KVMMouseMessage{Type: protocol.TypeKVMMouse, DX: 10, DY: 5, Buttons: 0, T: now - 1000},
			wantErr: true,
			errCode: ErrStaleCommand,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := v.ValidateKVMMouse(tt.msg)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
					return
				}
				ve, ok := err.(*ValidationError)
				if !ok {
					t.Errorf("expected ValidationError, got %T", err)
					return
				}
				if ve.Code != tt.errCode {
					t.Errorf("expected code %s, got %s", tt.errCode, ve.Code)
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestValidator_ValidateEStop(t *testing.T) {
	v := NewValidator(500 * time.Millisecond)
	now := time.Now().UnixMilli()

	tests := []struct {
		name    string
		msg     *protocol.EStopMessage
		wantErr bool
	}{
		{
			name:    "valid e-stop",
			msg:     &protocol.EStopMessage{Type: protocol.TypeEStop, T: now},
			wantErr: false,
		},
		{
			name:    "e-stop always accepted even if stale",
			msg:     &protocol.EStopMessage{Type: protocol.TypeEStop, T: now - 5000},
			wantErr: false, // E-stop is always accepted for safety
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := v.ValidateEStop(tt.msg)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}
