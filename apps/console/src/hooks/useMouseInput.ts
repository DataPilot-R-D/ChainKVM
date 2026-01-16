import { useEffect, useState, useCallback, useRef, RefObject } from 'react';

export interface MouseMovement {
  dx: number;
  dy: number;
}

export interface MouseButton {
  button: number;
}

export interface ScrollEvent {
  deltaY: number;
}

export interface KVMMouseCommand {
  dx: number;
  dy: number;
  buttons: number;
  scroll: number;
}

export interface UseMouseInputOptions {
  enabled: boolean;
  targetRef: RefObject<HTMLElement | null>;
  onMouseMove?: (movement: MouseMovement) => void;
  onMouseDown?: (event: MouseButton) => void;
  onMouseUp?: (event: MouseButton) => void;
  onScroll?: (event: ScrollEvent) => void;
  onKVMMouseCommand?: (command: KVMMouseCommand) => void;
  usePointerLock?: boolean;
  batchMs?: number;
}

// Convert button index to bitmask value
const buttonToBitmask = (button: number): number => {
  switch (button) {
    case 0: return 1;  // Left
    case 1: return 4;  // Middle
    case 2: return 2;  // Right (swapped for standard bitmask)
    default: return 0;
  }
};

// Convert pressed buttons set to bitmask
const buttonsToBitmask = (buttons: Set<number>): number => {
  let mask = 0;
  for (const button of buttons) {
    mask |= buttonToBitmask(button);
  }
  return mask;
};

export function useMouseInput({
  enabled,
  targetRef,
  onMouseMove,
  onMouseDown,
  onMouseUp,
  onScroll,
  onKVMMouseCommand,
  usePointerLock = false,
  batchMs = 0,
}: UseMouseInputOptions) {
  const [pressedButtons, setPressedButtons] = useState<Set<number>>(new Set());
  const accumulatedMovement = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const accumulatedScroll = useRef<number>(0);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCapturing = useRef<boolean>(false);

  const flushBatch = useCallback(() => {
    const { dx, dy } = accumulatedMovement.current;
    const scroll = accumulatedScroll.current;

    if (dx !== 0 || dy !== 0) {
      onMouseMove?.({ dx, dy });

      // Generate KVM command if handler provided
      if (onKVMMouseCommand) {
        const buttons = buttonsToBitmask(pressedButtons);
        onKVMMouseCommand({ dx, dy, buttons, scroll });
      }
    }

    accumulatedMovement.current = { dx: 0, dy: 0 };
    accumulatedScroll.current = 0;
  }, [onMouseMove, onKVMMouseCommand, pressedButtons]);

  const scheduleBatch = useCallback(() => {
    if (batchMs <= 0) {
      flushBatch();
      return;
    }

    if (batchTimer.current === null) {
      batchTimer.current = setTimeout(() => {
        flushBatch();
        batchTimer.current = null;
      }, batchMs);
    }
  }, [batchMs, flushBatch]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!enabled) return;

    accumulatedMovement.current.dx += event.movementX;
    accumulatedMovement.current.dy += event.movementY;

    scheduleBatch();
  }, [enabled, scheduleBatch]);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!enabled) return;

    onMouseDown?.({ button: event.button });

    setPressedButtons(prev => {
      const next = new Set(prev);
      next.add(event.button);
      return next;
    });
  }, [enabled, onMouseDown]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!enabled) return;

    onMouseUp?.({ button: event.button });

    setPressedButtons(prev => {
      const next = new Set(prev);
      next.delete(event.button);
      return next;
    });
  }, [enabled, onMouseUp]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!enabled) return;

    onScroll?.({ deltaY: event.deltaY });
    accumulatedScroll.current += event.deltaY;
  }, [enabled, onScroll]);

  const requestCapture = useCallback(() => {
    if (!usePointerLock || !targetRef.current) return;

    targetRef.current.requestPointerLock?.();
    isCapturing.current = true;
  }, [usePointerLock, targetRef]);

  const releaseCapture = useCallback(() => {
    if (!usePointerLock) return;

    document.exitPointerLock?.();
    isCapturing.current = false;
  }, [usePointerLock]);

  // Add/remove event listeners
  useEffect(() => {
    const target = targetRef.current;
    if (!enabled || !target) {
      setPressedButtons(new Set());
      return;
    }

    target.addEventListener('mousemove', handleMouseMove);
    target.addEventListener('mousedown', handleMouseDown);
    target.addEventListener('mouseup', handleMouseUp);
    target.addEventListener('wheel', handleWheel);

    return () => {
      target.removeEventListener('mousemove', handleMouseMove);
      target.removeEventListener('mousedown', handleMouseDown);
      target.removeEventListener('mouseup', handleMouseUp);
      target.removeEventListener('wheel', handleWheel);

      // Clear any pending batch
      if (batchTimer.current) {
        clearTimeout(batchTimer.current);
        batchTimer.current = null;
      }
    };
  }, [enabled, targetRef, handleMouseMove, handleMouseDown, handleMouseUp, handleWheel]);

  // Clear state when disabled
  useEffect(() => {
    if (!enabled) {
      setPressedButtons(new Set());
      accumulatedMovement.current = { dx: 0, dy: 0 };
      accumulatedScroll.current = 0;
    }
  }, [enabled]);

  return {
    pressedButtons,
    requestCapture,
    releaseCapture,
    isCapturing: isCapturing.current,
  };
}
