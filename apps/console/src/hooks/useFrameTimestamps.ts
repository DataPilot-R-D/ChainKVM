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
  parseErrors: number;       // Count of JSON parse failures
  lastError: string | null;  // Most recent error message
}

/**
 * Type guard to validate FrameTimestampMessage structure at runtime.
 * Ensures Go and TypeScript protocol compatibility.
 */
function isFrameTimestampMessage(obj: unknown): obj is FrameTimestampMessage {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const msg = obj as Record<string, unknown>;

  return (
    msg.type === 'frame_timestamp' &&
    typeof msg.timestamp === 'number' &&
    typeof msg.frame_id === 'number' &&
    typeof msg.sequence_number === 'number'
  );
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
    parseErrors: 0,
    lastError: null,
  });

  // Track if we've received first message (for drop detection)
  const receivedFirstRef = useRef(false);

  useEffect(() => {
    if (!dataChannel) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        // Validate structure before using
        if (!isFrameTimestampMessage(msg)) {
          // Silently ignore non-timestamp messages (e.g., ping/pong, control messages).
          // This is intentional: DataChannel may carry multiple message types,
          // and only 'frame_timestamp' messages are relevant here.
          if (typeof msg === 'object' && msg !== null && msg.type !== 'frame_timestamp') {
            return;
          }
          // Log and track invalid structure
          console.error('[FrameTimestamps] Invalid message structure:', msg);
          setBuffer((prev) => ({
            ...prev,
            parseErrors: prev.parseErrors + 1,
            lastError: 'Invalid message structure',
          }));
          return;
        }

        setBuffer((prev) => {
          // Detect dropped messages (sequence gap > 1)
          let dropped = 0;
          if (receivedFirstRef.current && msg.sequence_number > prev.lastSequence + 1) {
            dropped = msg.sequence_number - prev.lastSequence - 1;
          }
          receivedFirstRef.current = true;

          // Keep last 100 timestamps (ring buffer).
          // Math: slice(-99) keeps up to 99 elements, + 1 new = max 100.
          // This bounds memory usage while preserving enough history for statistics.
          const newTimestamps = [...prev.timestamps.slice(-99), msg.timestamp];

          return {
            timestamps: newTimestamps,
            lastSequence: msg.sequence_number,
            droppedMessages: prev.droppedMessages + dropped,
            parseErrors: prev.parseErrors,
            lastError: null,
          };
        });
      } catch (error) {
        console.error('[FrameTimestamps] Failed to parse message:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        setBuffer((prev) => ({
          ...prev,
          parseErrors: prev.parseErrors + 1,
          lastError: errorMessage.substring(0, 100),
        }));
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
