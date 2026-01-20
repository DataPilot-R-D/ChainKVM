import { renderHook, waitFor } from '@testing-library/react';
import { useFrameTimestamps, FrameTimestampMessage } from '../useFrameTimestamps';
import { vi } from 'vitest';

describe('useFrameTimestamps', () => {
  let mockDataChannel: RTCDataChannel;
  let messageHandlers: ((event: MessageEvent) => void)[];

  beforeEach(() => {
    messageHandlers = [];

    mockDataChannel = {
      addEventListener: vi.fn((event: string, handler: (event: MessageEvent) => void) => {
        if (event === 'message') {
          messageHandlers.push(handler);
        }
      }),
      removeEventListener: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty buffer', () => {
    const { result } = renderHook(() => useFrameTimestamps(mockDataChannel));

    expect(result.current.timestamps).toEqual([]);
    expect(result.current.lastSequence).toBe(0);
    expect(result.current.droppedMessages).toBe(0);
    expect(result.current.parseErrors).toBe(0);
    expect(result.current.lastError).toBeNull();
  });

  it('should handle null dataChannel gracefully', () => {
    const { result } = renderHook(() => useFrameTimestamps(null));

    expect(result.current.timestamps).toEqual([]);
    expect(result.current.droppedMessages).toBe(0);
    expect(result.current.parseErrors).toBe(0);
    expect(result.current.lastError).toBeNull();
  });

  it('should parse and store timestamp message', async () => {
    const { result } = renderHook(() => useFrameTimestamps(mockDataChannel));

    const msg: FrameTimestampMessage = {
      type: 'frame_timestamp',
      timestamp: Date.now(),
      frame_id: 1,
      sequence_number: 1,
    };

    const event = new MessageEvent('message', {
      data: JSON.stringify(msg),
    });

    messageHandlers[0](event);

    await waitFor(() => {
      expect(result.current.timestamps).toHaveLength(1);
    });

    expect(result.current.timestamps[0]).toBe(msg.timestamp);
    expect(result.current.lastSequence).toBe(1);
    expect(result.current.droppedMessages).toBe(0);
  });

  it('should detect dropped messages', async () => {
    const { result } = renderHook(() => useFrameTimestamps(mockDataChannel));

    // Send message with sequence 1
    const msg1: FrameTimestampMessage = {
      type: 'frame_timestamp',
      timestamp: Date.now(),
      frame_id: 1,
      sequence_number: 1,
    };
    messageHandlers[0](new MessageEvent('message', { data: JSON.stringify(msg1) }));

    await waitFor(() => {
      expect(result.current.timestamps).toHaveLength(1);
    });

    // Send message with sequence 4 (dropped 2 and 3)
    const msg2: FrameTimestampMessage = {
      type: 'frame_timestamp',
      timestamp: Date.now(),
      frame_id: 4,
      sequence_number: 4,
    };
    messageHandlers[0](new MessageEvent('message', { data: JSON.stringify(msg2) }));

    await waitFor(() => {
      expect(result.current.droppedMessages).toBe(2);
    });

    expect(result.current.timestamps).toHaveLength(2);
    expect(result.current.lastSequence).toBe(4);
  });

  it('should ignore non-timestamp messages', async () => {
    const { result } = renderHook(() => useFrameTimestamps(mockDataChannel));

    const nonTimestampMsg = {
      type: 'ping',
      seq: 1,
      t_mono: Date.now(),
    };

    messageHandlers[0](
      new MessageEvent('message', { data: JSON.stringify(nonTimestampMsg) })
    );

    // Wait a bit to ensure no state change
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(result.current.timestamps).toHaveLength(0);
    expect(result.current.lastSequence).toBe(0);
  });

  it('should handle invalid JSON gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useFrameTimestamps(mockDataChannel));

    messageHandlers[0](new MessageEvent('message', { data: 'invalid json' }));

    // Wait for state update
    await waitFor(() => {
      expect(result.current.parseErrors).toBe(1);
    });

    expect(result.current.timestamps).toHaveLength(0);
    expect(result.current.lastError).not.toBeNull();
    expect(result.current.lastError).toContain('Unexpected token');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[FrameTimestamps] Failed to parse message'),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useFrameTimestamps(mockDataChannel));

    expect(mockDataChannel.addEventListener).toHaveBeenCalled();

    unmount();

    expect(mockDataChannel.removeEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
  });

  it('should handle message burst after sequence gap', async () => {
    const { result } = renderHook(() => useFrameTimestamps(mockDataChannel));

    // Send first message
    const msg1: FrameTimestampMessage = {
      type: 'frame_timestamp',
      timestamp: Date.now(),
      frame_id: 1,
      sequence_number: 1,
    };
    messageHandlers[0](new MessageEvent('message', { data: JSON.stringify(msg1) }));

    await waitFor(() => {
      expect(result.current.timestamps).toHaveLength(1);
    });

    // Simulate dropped messages 2-5, then burst 6-10
    for (let i = 6; i <= 10; i++) {
      const msg: FrameTimestampMessage = {
        type: 'frame_timestamp',
        timestamp: Date.now() + i,
        frame_id: i,
        sequence_number: i,
      };
      messageHandlers[0](new MessageEvent('message', { data: JSON.stringify(msg) }));
    }

    await waitFor(() => {
      expect(result.current.timestamps).toHaveLength(6);
    });

    // Should detect 4 dropped messages (2, 3, 4, 5)
    expect(result.current.droppedMessages).toBe(4);
    expect(result.current.lastSequence).toBe(10);
  });
});
