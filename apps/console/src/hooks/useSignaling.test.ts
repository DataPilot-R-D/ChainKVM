/**
 * Tests for useSignaling hook - WebSocket signaling with revocation handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSignaling } from './useSignaling';
import { MockWebSocket } from './__tests__/useSignaling.mock';

describe('useSignaling', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  describe('connection lifecycle', () => {
    it('should connect to signaling server', async () => {
      const { result } = renderHook(() =>
        useSignaling({ url: 'ws://localhost:8080/signal' })
      );
      expect(result.current.status).toBe('connecting');
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      expect(result.current.status).toBe('connected');
    });

    it('should handle disconnect', async () => {
      const { result } = renderHook(() =>
        useSignaling({ url: 'ws://localhost:8080/signal' })
      );
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      act(() => { MockWebSocket.instances[0].simulateClose(); });
      expect(result.current.status).toBe('disconnected');
    });

    it('should handle connection error', async () => {
      const { result } = renderHook(() =>
        useSignaling({ url: 'ws://localhost:8080/signal' })
      );
      act(() => { MockWebSocket.instances[0].simulateError(); });
      expect(result.current.status).toBe('error');
    });

    it('should not connect when disabled', () => {
      renderHook(() =>
        useSignaling({ url: 'ws://localhost:8080/signal', enabled: false })
      );
      expect(MockWebSocket.instances.length).toBe(0);
    });
  });

  describe('sending messages', () => {
    it('should send join message', async () => {
      const { result } = renderHook(() =>
        useSignaling({ url: 'ws://localhost:8080/signal' })
      );
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      act(() => { result.current.sendJoin('ses_123', 'operator', 'token_abc'); });
      const sent = JSON.parse(MockWebSocket.instances[0].sentMessages[0]);
      expect(sent).toMatchObject({ type: 'join', session_id: 'ses_123', role: 'operator', token: 'token_abc' });
    });

    it('should send offer message', async () => {
      const { result } = renderHook(() =>
        useSignaling({ url: 'ws://localhost:8080/signal' })
      );
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      const sdp = { type: 'offer' as const, sdp: 'v=0...' };
      act(() => { result.current.sendOffer('ses_123', sdp); });
      const sent = JSON.parse(MockWebSocket.instances[0].sentMessages[0]);
      expect(sent).toMatchObject({ type: 'offer', session_id: 'ses_123', sdp });
    });

    it('should send ICE candidate', async () => {
      const { result } = renderHook(() =>
        useSignaling({ url: 'ws://localhost:8080/signal' })
      );
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      const candidate = { candidate: 'candidate:1...' };
      act(() => { result.current.sendIce('ses_123', candidate); });
      const sent = JSON.parse(MockWebSocket.instances[0].sentMessages[0]);
      expect(sent).toMatchObject({ type: 'ice', session_id: 'ses_123', candidate });
    });
  });

  describe('receiving messages', () => {
    it('should call onOffer callback', async () => {
      const onOffer = vi.fn();
      renderHook(() => useSignaling({ url: 'ws://localhost:8080/signal', onOffer }));
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      const sdp = { type: 'offer' as const, sdp: 'v=0...' };
      act(() => { MockWebSocket.instances[0].simulateMessage({ type: 'offer', session_id: 'ses_123', sdp }); });
      expect(onOffer).toHaveBeenCalledWith('ses_123', sdp);
    });

    it('should call onAnswer callback', async () => {
      const onAnswer = vi.fn();
      renderHook(() => useSignaling({ url: 'ws://localhost:8080/signal', onAnswer }));
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      const sdp = { type: 'answer' as const, sdp: 'v=0...' };
      act(() => { MockWebSocket.instances[0].simulateMessage({ type: 'answer', session_id: 'ses_123', sdp }); });
      expect(onAnswer).toHaveBeenCalledWith('ses_123', sdp);
    });

    it('should call onIceCandidate callback', async () => {
      const onIceCandidate = vi.fn();
      renderHook(() => useSignaling({ url: 'ws://localhost:8080/signal', onIceCandidate }));
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      const candidate = { candidate: 'candidate:1...' };
      act(() => { MockWebSocket.instances[0].simulateMessage({ type: 'ice', session_id: 'ses_123', candidate }); });
      expect(onIceCandidate).toHaveBeenCalledWith('ses_123', candidate);
    });
  });

  describe('revocation handling', () => {
    it('should handle revoked message and set reason', async () => {
      const onRevoked = vi.fn();
      const { result } = renderHook(() =>
        useSignaling({ url: 'ws://localhost:8080/signal', onRevoked })
      );
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      expect(result.current.revocationReason).toBeNull();
      act(() => {
        MockWebSocket.instances[0].simulateMessage({
          type: 'revoked', session_id: 'ses_123', reason: 'Admin terminated session',
        });
      });
      expect(result.current.revocationReason).toBe('Admin terminated session');
      expect(onRevoked).toHaveBeenCalledWith('ses_123', 'Admin terminated session');
    });

    it('should handle revoked message without reason', async () => {
      const onRevoked = vi.fn();
      const { result } = renderHook(() =>
        useSignaling({ url: 'ws://localhost:8080/signal', onRevoked })
      );
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      act(() => { MockWebSocket.instances[0].simulateMessage({ type: 'revoked', session_id: 'ses_123' }); });
      expect(result.current.revocationReason).toBe('Unknown reason');
      expect(onRevoked).toHaveBeenCalledWith('ses_123', 'Unknown reason');
    });

    it('should log warning on revocation', async () => {
      renderHook(() => useSignaling({ url: 'ws://localhost:8080/signal' }));
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      act(() => {
        MockWebSocket.instances[0].simulateMessage({
          type: 'revoked', session_id: 'ses_123', reason: 'Test revocation',
        });
      });
      expect(console.warn).toHaveBeenCalledWith('[Signaling] Session revoked:', 'Test revocation');
    });
  });

  describe('error handling', () => {
    it('should call onError callback', async () => {
      const onError = vi.fn();
      renderHook(() => useSignaling({ url: 'ws://localhost:8080/signal', onError }));
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      act(() => {
        MockWebSocket.instances[0].simulateMessage({
          type: 'error', code: 'TOKEN_INVALID', message: 'Token has been revoked',
        });
      });
      expect(onError).toHaveBeenCalledWith('TOKEN_INVALID', 'Token has been revoked');
    });

    it('should handle malformed messages gracefully', async () => {
      renderHook(() => useSignaling({ url: 'ws://localhost:8080/signal' }));
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      act(() => { MockWebSocket.instances[0].onmessage?.({ data: 'not json' }); });
      expect(console.error).toHaveBeenCalledWith(
        '[Signaling] Failed to parse message:',
        expect.any(String),
        'Preview:',
        'not json'
      );
    });
  });

  describe('disconnect', () => {
    it('should close connection on disconnect', async () => {
      const { result } = renderHook(() =>
        useSignaling({ url: 'ws://localhost:8080/signal' })
      );
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      act(() => { result.current.disconnect(); });
      expect(result.current.status).toBe('disconnected');
    });

    it('should clear revocation reason on new connection', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useSignaling({ url: 'ws://localhost:8080/signal', enabled }),
        { initialProps: { enabled: true } }
      );
      act(() => { MockWebSocket.instances[0].simulateOpen(); });
      act(() => {
        MockWebSocket.instances[0].simulateMessage({
          type: 'revoked', session_id: 'ses_123', reason: 'First revocation',
        });
      });
      expect(result.current.revocationReason).toBe('First revocation');
      rerender({ enabled: false });
      rerender({ enabled: true });
      expect(result.current.revocationReason).toBeNull();
    });
  });
});
