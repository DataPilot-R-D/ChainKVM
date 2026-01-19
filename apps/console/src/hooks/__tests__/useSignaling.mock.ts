/**
 * MockWebSocket for testing useSignaling hook.
 */
import type { SignalingMessage } from '../useSignaling';

export class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readyState = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: 'Normal closure' });
  }

  simulateOpen(): void {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(msg: SignalingMessage): void {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  simulateClose(code = 1000, reason = ''): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }

  simulateError(): void {
    this.onerror?.();
  }
}
