import { appendFile } from 'node:fs/promises';
import type { MetricsLogEvent } from '../types.js';

export class MetricsLogger {
  private logPath: string | null;

  constructor(logPath?: string | null) {
    const trimmed = logPath?.trim();
    this.logPath = trimmed ? trimmed : null;
  }

  get enabled(): boolean {
    return this.logPath !== null;
  }

  async log(event: MetricsLogEvent): Promise<void> {
    if (!this.logPath) {
      return;
    }

    const line = `${JSON.stringify(event)}\n`;
    try {
      await appendFile(this.logPath, line, { encoding: 'utf8' });
    } catch {
      // Best-effort metrics logging: avoid impacting request flow.
    }
  }
}
