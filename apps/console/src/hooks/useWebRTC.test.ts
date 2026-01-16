import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebRTC } from './useWebRTC';
import type { SignalingCallbacks, WebRTCConfig } from './useWebRTC';

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  connectionState: RTCPeerConnectionState = 'new';
  iceConnectionState: RTCIceConnectionState = 'new';
  iceGatheringState: RTCIceGatheringState = 'new';
  signalingState: RTCSignalingState = 'stable';

  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null;

  private dataChannels: Map<string, MockRTCDataChannel> = new Map();

  createOffer = vi.fn().mockResolvedValue({
    type: 'offer',
    sdp: 'mock-offer-sdp',
  } as RTCSessionDescriptionInit);

  createAnswer = vi.fn().mockResolvedValue({
    type: 'answer',
    sdp: 'mock-answer-sdp',
  } as RTCSessionDescriptionInit);

  setLocalDescription = vi.fn().mockImplementation(async (desc) => {
    this.localDescription = desc as RTCSessionDescription;
  });

  setRemoteDescription = vi.fn().mockImplementation(async (desc) => {
    this.remoteDescription = desc as RTCSessionDescription;
  });

  addIceCandidate = vi.fn().mockResolvedValue(undefined);

  createDataChannel = vi.fn().mockImplementation((label: string, options?: RTCDataChannelInit) => {
    const channel = new MockRTCDataChannel(label, options);
    this.dataChannels.set(label, channel);
    return channel;
  });

  close = vi.fn().mockImplementation(() => {
    this.connectionState = 'closed';
    this.onconnectionstatechange?.();
  });

  getStats = vi.fn().mockResolvedValue(new Map());

  restartIce = vi.fn();

  // Helper to simulate connection state changes
  simulateConnectionState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }

  simulateIceConnectionState(state: RTCIceConnectionState) {
    this.iceConnectionState = state;
    this.oniceconnectionstatechange?.();
  }

  simulateIceCandidate(candidate: RTCIceCandidate | null) {
    this.onicecandidate?.({ candidate } as RTCPeerConnectionIceEvent);
  }

  simulateTrack(track: MediaStreamTrack, streams: MediaStream[]) {
    this.ontrack?.({ track, streams } as unknown as RTCTrackEvent);
  }

  simulateDataChannel(channel: MockRTCDataChannel) {
    this.ondatachannel?.({ channel } as unknown as RTCDataChannelEvent);
  }
}

class MockRTCDataChannel {
  label: string;
  ordered: boolean;
  readyState: RTCDataChannelState = 'connecting';
  bufferedAmount = 0;

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(label: string, options?: RTCDataChannelInit) {
    this.label = label;
    this.ordered = options?.ordered ?? true;
  }

  send = vi.fn();
  close = vi.fn().mockImplementation(() => {
    this.readyState = 'closed';
    this.onclose?.();
  });

  simulateOpen() {
    this.readyState = 'open';
    this.onopen?.();
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

// Setup global mocks
let mockPeerConnection: MockRTCPeerConnection;
const constructorCalls: unknown[][] = [];

// Create a factory that returns new instances but stores them for testing
function createMockRTCPeerConnectionFactory() {
  return class MockRTCPeerConnectionFactory {
    constructor(...args: unknown[]) {
      constructorCalls.push(args);
      mockPeerConnection = new MockRTCPeerConnection();
      return mockPeerConnection;
    }
  };
}

beforeEach(() => {
  mockPeerConnection = new MockRTCPeerConnection();
  constructorCalls.length = 0;

  vi.stubGlobal('RTCPeerConnection', createMockRTCPeerConnectionFactory());
  vi.stubGlobal('RTCSessionDescription', class {
    type: string;
    sdp: string;
    constructor(init: RTCSessionDescriptionInit) {
      this.type = init.type;
      this.sdp = init.sdp || '';
    }
  });
  vi.stubGlobal('RTCIceCandidate', class {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    constructor(init: RTCIceCandidateInit) {
      this.candidate = init.candidate || '';
      this.sdpMid = init.sdpMid ?? null;
      this.sdpMLineIndex = init.sdpMLineIndex ?? null;
    }
  });
  vi.stubGlobal('MediaStream', class MockMediaStream {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useWebRTC', () => {
  const defaultConfig: WebRTCConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  const createMockSignaling = (): SignalingCallbacks => ({
    onLocalOffer: vi.fn(),
    onLocalAnswer: vi.fn(),
    onIceCandidate: vi.fn(),
  });

  describe('initialization', () => {
    it('should create RTCPeerConnection with config', () => {
      const signaling = createMockSignaling();

      renderHook(() => useWebRTC({ config: defaultConfig, signaling }));

      expect(constructorCalls.length).toBe(1);
      expect(constructorCalls[0][0]).toEqual({
        iceServers: defaultConfig.iceServers,
      });
    });

    it('should initialize with disconnected state', () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      expect(result.current.connectionState).toBe('new');
      expect(result.current.isConnected).toBe(false);
    });

    it('should not create connection when disabled', () => {
      const signaling = createMockSignaling();

      renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling, enabled: false })
      );

      expect(constructorCalls.length).toBe(0);
    });
  });

  describe('offer/answer exchange', () => {
    it('should create and send offer when initiating', async () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      await act(async () => {
        await result.current.createOffer();
      });

      expect(mockPeerConnection.createOffer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith({
        type: 'offer',
        sdp: 'mock-offer-sdp',
      });
      expect(signaling.onLocalOffer).toHaveBeenCalledWith({
        type: 'offer',
        sdp: 'mock-offer-sdp',
      });
    });

    it('should handle remote offer and create answer', async () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      const remoteOffer = { type: 'offer' as const, sdp: 'remote-offer-sdp' };

      await act(async () => {
        await result.current.handleRemoteOffer(remoteOffer);
      });

      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalledWith(
        remoteOffer
      );
      expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith({
        type: 'answer',
        sdp: 'mock-answer-sdp',
      });
      expect(signaling.onLocalAnswer).toHaveBeenCalledWith({
        type: 'answer',
        sdp: 'mock-answer-sdp',
      });
    });

    it('should handle remote answer', async () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      const remoteAnswer = { type: 'answer' as const, sdp: 'remote-answer-sdp' };

      await act(async () => {
        await result.current.handleRemoteAnswer(remoteAnswer);
      });

      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalledWith(
        remoteAnswer
      );
    });
  });

  describe('ICE candidate handling', () => {
    it('should send local ICE candidates to signaling', async () => {
      const signaling = createMockSignaling();

      renderHook(() => useWebRTC({ config: defaultConfig, signaling }));

      const candidate = {
        candidate: 'candidate:123',
        sdpMid: '0',
        sdpMLineIndex: 0,
      } as RTCIceCandidate;

      act(() => {
        mockPeerConnection.simulateIceCandidate(candidate);
      });

      expect(signaling.onIceCandidate).toHaveBeenCalledWith(candidate);
    });

    it('should not send null ICE candidate (gathering complete)', () => {
      const signaling = createMockSignaling();

      renderHook(() => useWebRTC({ config: defaultConfig, signaling }));

      act(() => {
        mockPeerConnection.simulateIceCandidate(null);
      });

      expect(signaling.onIceCandidate).not.toHaveBeenCalled();
    });

    it('should add remote ICE candidate', async () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      const candidate = {
        candidate: 'candidate:456',
        sdpMid: '0',
        sdpMLineIndex: 0,
      };

      await act(async () => {
        await result.current.addIceCandidate(candidate);
      });

      expect(mockPeerConnection.addIceCandidate).toHaveBeenCalledWith(candidate);
    });
  });

  describe('connection state management', () => {
    it('should update connectionState when peer connection state changes', () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      act(() => {
        mockPeerConnection.simulateConnectionState('connecting');
      });

      expect(result.current.connectionState).toBe('connecting');
      expect(result.current.isConnected).toBe(false);

      act(() => {
        mockPeerConnection.simulateConnectionState('connected');
      });

      expect(result.current.connectionState).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });

    it('should report disconnected state correctly', () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      act(() => {
        mockPeerConnection.simulateConnectionState('disconnected');
      });

      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });

    it('should report failed state correctly', () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      act(() => {
        mockPeerConnection.simulateConnectionState('failed');
      });

      expect(result.current.connectionState).toBe('failed');
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('DataChannel creation', () => {
    it('should create reliable DataChannel', async () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      let channel: MockRTCDataChannel | undefined;
      await act(async () => {
        channel = result.current.createDataChannel('commands', {
          ordered: true,
        }) as unknown as MockRTCDataChannel;
      });

      expect(mockPeerConnection.createDataChannel).toHaveBeenCalledWith(
        'commands',
        { ordered: true }
      );
      expect(channel?.label).toBe('commands');
      expect(channel?.ordered).toBe(true);
    });

    it('should create unreliable DataChannel for telemetry', async () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      await act(async () => {
        result.current.createDataChannel('telemetry', {
          ordered: false,
          maxRetransmits: 0,
        });
      });

      expect(mockPeerConnection.createDataChannel).toHaveBeenCalledWith(
        'telemetry',
        { ordered: false, maxRetransmits: 0 }
      );
    });

    it('should track DataChannel state', async () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      expect(result.current.dataChannelState).toBe('closed');

      let channel: MockRTCDataChannel | undefined;
      await act(async () => {
        channel = result.current.createDataChannel('commands', {
          ordered: true,
        }) as unknown as MockRTCDataChannel;
      });

      expect(result.current.dataChannelState).toBe('connecting');

      act(() => {
        channel?.simulateOpen();
      });

      expect(result.current.dataChannelState).toBe('open');
    });
  });

  describe('video track handling', () => {
    it('should provide remote stream when track is received', () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      expect(result.current.remoteStream).toBeNull();

      const mockTrack = { kind: 'video' } as MediaStreamTrack;
      const mockStream = new MediaStream();

      act(() => {
        mockPeerConnection.simulateTrack(mockTrack, [mockStream]);
      });

      expect(result.current.remoteStream).toBe(mockStream);
    });

    it('should call onTrack callback when track is received', () => {
      const signaling = createMockSignaling();
      const onTrack = vi.fn();

      renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling, onTrack })
      );

      const mockTrack = { kind: 'video' } as MediaStreamTrack;
      const mockStream = new MediaStream();

      act(() => {
        mockPeerConnection.simulateTrack(mockTrack, [mockStream]);
      });

      expect(onTrack).toHaveBeenCalledWith(mockTrack, mockStream);
    });
  });

  describe('reconnection logic', () => {
    it('should attempt reconnection on disconnected state', async () => {
      vi.useFakeTimers();
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({
          config: defaultConfig,
          signaling,
          reconnect: { enabled: true, maxAttempts: 3, delayMs: 1000 },
        })
      );

      // First connect
      act(() => {
        mockPeerConnection.simulateConnectionState('connected');
      });

      expect(result.current.isConnected).toBe(true);

      // Then disconnect
      act(() => {
        mockPeerConnection.simulateConnectionState('disconnected');
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.reconnectAttempts).toBe(0);

      // Advance timer to trigger reconnection
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.reconnectAttempts).toBe(1);

      vi.useRealTimers();
    });

    it('should stop reconnecting after max attempts', async () => {
      vi.useFakeTimers();
      const signaling = createMockSignaling();
      const onReconnectFailed = vi.fn();

      const { result } = renderHook(() =>
        useWebRTC({
          config: defaultConfig,
          signaling,
          reconnect: { enabled: true, maxAttempts: 2, delayMs: 100 },
          onReconnectFailed,
        })
      );

      // Connect then disconnect
      act(() => {
        mockPeerConnection.simulateConnectionState('connected');
      });
      act(() => {
        mockPeerConnection.simulateConnectionState('disconnected');
      });

      // Exhaust reconnection attempts
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current.reconnectAttempts).toBe(1);

      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current.reconnectAttempts).toBe(2);

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(onReconnectFailed).toHaveBeenCalled();
      expect(result.current.reconnectAttempts).toBe(2);

      vi.useRealTimers();
    });

    it('should reset reconnect attempts on successful connection', async () => {
      vi.useFakeTimers();
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({
          config: defaultConfig,
          signaling,
          reconnect: { enabled: true, maxAttempts: 3, delayMs: 100 },
        })
      );

      // Connect, disconnect, reconnect attempt
      act(() => {
        mockPeerConnection.simulateConnectionState('connected');
      });
      act(() => {
        mockPeerConnection.simulateConnectionState('disconnected');
      });
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.reconnectAttempts).toBe(1);

      // Successful reconnection
      act(() => {
        mockPeerConnection.simulateConnectionState('connected');
      });

      expect(result.current.reconnectAttempts).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('should close connection on unmount', () => {
      const signaling = createMockSignaling();

      const { unmount } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      unmount();

      expect(mockPeerConnection.close).toHaveBeenCalled();
    });

    it('should close connection when calling disconnect', () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      act(() => {
        result.current.disconnect();
      });

      expect(mockPeerConnection.close).toHaveBeenCalled();
    });
  });

  describe('ICE restart', () => {
    it('should restart ICE when called', async () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      await act(async () => {
        await result.current.restartIce();
      });

      expect(mockPeerConnection.restartIce).toHaveBeenCalled();
      expect(mockPeerConnection.createOffer).toHaveBeenCalledWith({
        iceRestart: true,
      });
    });

    it('should send new offer after ICE restart', async () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      await act(async () => {
        await result.current.restartIce();
      });

      expect(signaling.onLocalOffer).toHaveBeenCalled();
    });
  });

  describe('connection diagnostics', () => {
    it('should track ICE gathering state', () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      expect(result.current.iceGatheringState).toBe('new');

      act(() => {
        mockPeerConnection.iceGatheringState = 'gathering';
        mockPeerConnection.onicegatheringstatechange?.();
      });

      expect(result.current.iceGatheringState).toBe('gathering');
    });

    it('should track ICE connection state', () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      expect(result.current.iceConnectionState).toBe('new');

      act(() => {
        mockPeerConnection.simulateIceConnectionState('checking');
      });

      expect(result.current.iceConnectionState).toBe('checking');
    });

    it('should call onIceGatheringComplete when gathering finishes', () => {
      const signaling = createMockSignaling();
      const onIceGatheringComplete = vi.fn();

      renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling, onIceGatheringComplete })
      );

      act(() => {
        mockPeerConnection.iceGatheringState = 'complete';
        mockPeerConnection.onicegatheringstatechange?.();
      });

      expect(onIceGatheringComplete).toHaveBeenCalled();
    });

    it('should provide connection stats via getConnectionStats', async () => {
      const signaling = createMockSignaling();

      const { result } = renderHook(() =>
        useWebRTC({ config: defaultConfig, signaling })
      );

      // Set up mock after hook creates the peer connection
      const mockStats = new Map([
        ['candidate-pair', { type: 'candidate-pair', state: 'succeeded' }],
      ]);
      mockPeerConnection.getStats.mockResolvedValue(mockStats);

      let stats: RTCStatsReport | null = null;
      await act(async () => {
        stats = await result.current.getConnectionStats();
      });

      expect(mockPeerConnection.getStats).toHaveBeenCalled();
      expect(stats).toBe(mockStats);
    });
  });
});
