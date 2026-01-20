import { useState, useEffect, useRef } from 'react';

/**
 * FrameTimestampMessage matches the protocol.FrameTimestampMessage from robot agent.
 * Received via WebRTC DataChannel for video latency measurement.
 */
export interface FrameTimestampMessage {
  type: 'frame_timestamp';
  timestamp: number;        // Unix milliseconds when frame was captured
  frame_id: number;         // Monotonic frame counter
  sequence_number: number;  // Message sequence for loss detection
}

/**
 * TimestampBuffer holds received timestamps and tracks message loss.
 */
export interface TimestampBuffer {
  timestamps: number[];      // Last N timestamps (ring buffer)
  lastSequence: number;      // Last received sequence number
  droppedMessages: number;   // Count of detected dropped messages
}

/**
 * useFrameTimestamps listens for frame timestamp messages on the DataChannel.
 *
 * @param dataChannel - RTCDataChannel to listen on (null if not connected)
 * @returns TimestampBuffer with received timestamps and statistics
 *
 * @example
 * ```tsx
 * const timestampBuffer = useFrameTimestamps(dataChannel);
 * console.log(`Received ${timestampBuffer.timestamps.length} timestamps`);
 * console.log(`Dropped ${timestampBuffer.droppedMessages} messages`);
 * ```
 */
export function useFrameTimestamps(
  dataChannel: RTCDataChannel | null
): TimestampBuffer {
  const [buffer, setBuffer] = useState<TimestampBuffer>({
    timestamps: [],
    lastSequence: 0,
    droppedMessages: 0,
  });

  // Track if we've received first message (for drop detection)
  const receivedFirstRef = useRef(false);

  useEffect(() => {
    if (!dataChannel) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as FrameTimestampMessage;

        // Ignore non-timestamp messages
        if (msg.type !== 'frame_timestamp') {
          return;
        }

        setBuffer((prev) => {
          // Detect dropped messages (sequence gap > 1)
          let dropped = 0;
          if (receivedFirstRef.current && msg.sequence_number > prev.lastSequence + 1) {
            dropped = msg.sequence_number - prev.lastSequence - 1;
          }
          receivedFirstRef.current = true;

          // Keep last 100 timestamps (ring buffer)
          const newTimestamps = [...prev.timestamps.slice(-99), msg.timestamp];

          return {
            timestamps: newTimestamps,
            lastSequence: msg.sequence_number,
            droppedMessages: prev.droppedMessages + dropped,
          };
        });
      } catch (error) {
        console.error('[FrameTimestamps] Failed to parse message:', error);
      }
    };

    dataChannel.addEventListener('message', handleMessage);

    return () => {
      dataChannel.removeEventListener('message', handleMessage);
      receivedFirstRef.current = false;
    };
  }, [dataChannel]);

  return buffer;
}
