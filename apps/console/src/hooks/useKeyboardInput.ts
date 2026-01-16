import { useEffect, useState, useCallback, useRef } from 'react';

export interface DriveCommand {
  v: number; // Linear velocity [-1, 1]
  w: number; // Angular velocity [-1, 1]
}

export interface UseKeyboardInputOptions {
  enabled: boolean;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  onDriveCommand?: (command: DriveCommand) => void;
  onEStop?: () => void;
  debounceMs?: number;
}

// Key mappings for drive commands
const DRIVE_KEYS: Record<string, DriveCommand> = {
  KeyW: { v: 1, w: 0 },      // Forward
  KeyS: { v: -1, w: 0 },     // Backward
  KeyA: { v: 0, w: 1 },      // Turn left
  KeyD: { v: 0, w: -1 },     // Turn right
  ArrowUp: { v: 1, w: 0 },   // Forward
  ArrowDown: { v: -1, w: 0 }, // Backward
  ArrowLeft: { v: 0, w: 1 }, // Turn left
  ArrowRight: { v: 0, w: -1 }, // Turn right
};

const ESTOP_KEYS = new Set(['Space', 'Escape']);

export function useKeyboardInput({
  enabled,
  onKeyDown,
  onKeyUp,
  onDriveCommand,
  onEStop,
  debounceMs = 0,
}: UseKeyboardInputOptions) {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const lastCommandTime = useRef<number>(0);

  // Calculate drive command from pressed keys
  const calculateDriveCommand = useCallback((keys: Set<string>): DriveCommand => {
    let v = 0;
    let w = 0;

    for (const [code, command] of Object.entries(DRIVE_KEYS)) {
      if (keys.has(code)) {
        v += command.v;
        w += command.w;
      }
    }

    // Clamp values to [-1, 1]
    return {
      v: Math.max(-1, Math.min(1, v)),
      w: Math.max(-1, Math.min(1, w)),
    };
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Check E-Stop first
    if (ESTOP_KEYS.has(event.code)) {
      onEStop?.();
      return;
    }

    // Debounce repeated events
    if (event.repeat && debounceMs > 0) {
      const now = Date.now();
      if (now - lastCommandTime.current < debounceMs) {
        return;
      }
      lastCommandTime.current = now;
    }

    onKeyDown?.(event);

    // Track pressed keys and generate drive command
    if (DRIVE_KEYS[event.code]) {
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.add(event.code);

        // Generate drive command
        const command = calculateDriveCommand(next);
        onDriveCommand?.(command);

        return next;
      });
    }
  }, [enabled, onKeyDown, onDriveCommand, onEStop, debounceMs, calculateDriveCommand]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    onKeyUp?.(event);

    // Update pressed keys and generate stop/updated command
    if (DRIVE_KEYS[event.code]) {
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.delete(event.code);

        // Generate updated drive command (possibly stop)
        const command = calculateDriveCommand(next);
        onDriveCommand?.(command);

        return next;
      });
    }
  }, [enabled, onKeyUp, onDriveCommand, calculateDriveCommand]);

  // Add/remove event listeners
  useEffect(() => {
    if (!enabled) {
      setPressedKeys(new Set());
      return;
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, handleKeyDown, handleKeyUp]);

  // Clear pressed keys when disabled
  useEffect(() => {
    if (!enabled) {
      setPressedKeys(new Set());
    }
  }, [enabled]);

  return {
    pressedKeys,
  };
}
