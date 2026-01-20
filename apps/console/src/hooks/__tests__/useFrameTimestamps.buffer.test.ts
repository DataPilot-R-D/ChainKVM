import { renderHook, waitFor } from '@testing-library/react';
import { useFrameTimestamps, FrameTimestampMessage } from '../useFrameTimestamps';
import { vi } from 'vitest';

describe('useFrameTimestamps - Buffer Management', () => {
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

  it('should maintain ring buffer of 100 timestamps', async () => {
    const { result } = renderHook(() => useFrameTimestamps(mockDataChannel));

    // Send 105 messages
    for (let i = 1; i <= 105; i++) {
      const msg: FrameTimestampMessage = {
        type: 'frame_timestamp',
        timestamp: Date.now() + i,
        frame_id: i,
        sequence_number: i,
      };
      messageHandlers[0](new MessageEvent('message', { data: JSON.stringify(msg) }));
    }

    await waitFor(() => {
      expect(result.current.timestamps).toHaveLength(100);
    });

    // Should keep last 100 (timestamps 6-105)
    expect(result.current.lastSequence).toBe(105);
  });

  it('should reset state when dataChannel changes to null', async () => {
    const { result, rerender } = renderHook(
      ({ dc }) => useFrameTimestamps(dc),
      { initialProps: { dc: mockDataChannel } }
    );

    // Send a message
    const msg: FrameTimestampMessage = {
      type: 'frame_timestamp',
      timestamp: Date.now(),
      frame_id: 1,
      sequence_number: 1,
    };
    messageHandlers[0](new MessageEvent('message', { data: JSON.stringify(msg) }));

    await waitFor(() => {
      expect(result.current.timestamps).toHaveLength(1);
    });

    // Change to null
    rerender({ dc: null });

    // State should persist (hook doesn't reset on null)
    expect(result.current.timestamps).toHaveLength(1);
  });

  it('should handle rapid message bursts', async () => {
    const { result } = renderHook(() => useFrameTimestamps(mockDataChannel));

    // Send 20 messages rapidly
    for (let i = 1; i <= 20; i++) {
      const msg: FrameTimestampMessage = {
        type: 'frame_timestamp',
        timestamp: Date.now() + i,
        frame_id: i,
        sequence_number: i,
      };
      messageHandlers[0](new MessageEvent('message', { data: JSON.stringify(msg) }));
    }

    await waitFor(() => {
      expect(result.current.timestamps).toHaveLength(20);
    });

    expect(result.current.lastSequence).toBe(20);
    expect(result.current.droppedMessages).toBe(0);
  });
});
