import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKeyboardInput } from './useKeyboardInput';

describe('useKeyboardInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('keyboard capture', () => {
    it('captures keydown events when enabled', () => {
      const onKeyDown = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onKeyDown }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' }));
      });

      expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({
        key: 'w',
        code: 'KeyW',
      }));
    });

    it('captures keyup events when enabled', () => {
      const onKeyUp = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onKeyUp }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW' }));
      });

      expect(onKeyUp).toHaveBeenCalledWith(expect.objectContaining({
        key: 'w',
        code: 'KeyW',
      }));
    });

    it('ignores events when disabled', () => {
      const onKeyDown = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: false, onKeyDown }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' }));
      });

      expect(onKeyDown).not.toHaveBeenCalled();
    });

    it('tracks currently pressed keys', () => {
      const { result } = renderHook(() => useKeyboardInput({ enabled: true }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' }));
      });

      expect(result.current.pressedKeys.has('KeyW')).toBe(true);

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW' }));
      });

      expect(result.current.pressedKeys.has('KeyW')).toBe(false);
    });

    it('clears pressed keys when disabled', () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useKeyboardInput({ enabled }),
        { initialProps: { enabled: true } }
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' }));
      });

      expect(result.current.pressedKeys.has('KeyW')).toBe(true);

      rerender({ enabled: false });

      expect(result.current.pressedKeys.size).toBe(0);
    });
  });

  describe('drive commands', () => {
    it('generates forward drive command for W key', () => {
      const onDriveCommand = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onDriveCommand }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' }));
      });

      expect(onDriveCommand).toHaveBeenCalledWith({ v: 1, w: 0 });
    });

    it('generates backward drive command for S key', () => {
      const onDriveCommand = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onDriveCommand }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS' }));
      });

      expect(onDriveCommand).toHaveBeenCalledWith({ v: -1, w: 0 });
    });

    it('generates left turn for A key', () => {
      const onDriveCommand = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onDriveCommand }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' }));
      });

      expect(onDriveCommand).toHaveBeenCalledWith({ v: 0, w: 1 });
    });

    it('generates right turn for D key', () => {
      const onDriveCommand = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onDriveCommand }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD' }));
      });

      expect(onDriveCommand).toHaveBeenCalledWith({ v: 0, w: -1 });
    });

    it('generates stop command on key release', () => {
      const onDriveCommand = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onDriveCommand }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' }));
      });

      onDriveCommand.mockClear();

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW' }));
      });

      expect(onDriveCommand).toHaveBeenCalledWith({ v: 0, w: 0 });
    });

    it('supports arrow keys for drive', () => {
      const onDriveCommand = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onDriveCommand }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp' }));
      });

      expect(onDriveCommand).toHaveBeenCalledWith({ v: 1, w: 0 });
    });
  });

  describe('E-Stop shortcut', () => {
    it('triggers E-Stop on Space key', () => {
      const onEStop = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onEStop }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
      });

      expect(onEStop).toHaveBeenCalled();
    });

    it('triggers E-Stop on Escape key', () => {
      const onEStop = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onEStop }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      });

      expect(onEStop).toHaveBeenCalled();
    });
  });

  describe('debouncing', () => {
    it('debounces repeated keydown events', () => {
      const onDriveCommand = vi.fn();
      renderHook(() => useKeyboardInput({ enabled: true, onDriveCommand, debounceMs: 50 }));

      act(() => {
        // Simulate key repeat
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', repeat: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', repeat: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', repeat: true }));
      });

      // Should only process once due to debounce
      expect(onDriveCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useKeyboardInput({ enabled: true }));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});
