/**
 * Observation-only heartbeat monitor.
 * On failure: NO kill, NO restart, NO signal. Only updates internal status
 * and notifies opt-in listeners. Existing DH watchdog is NOT replaced.
 */

export interface HeartbeatTick {
  readonly id: string;
  readonly receivedAt: number;
}

export type HeartbeatStatus = "idle" | "healthy" | "stale";

export interface HeartbeatMonitorOptions {
  readonly intervalMs?: number;
  readonly staleAfterMs?: number;
}

export class HeartbeatMonitor {
  private readonly intervalMs: number;
  private readonly staleAfterMs: number;
  private lastTick: HeartbeatTick | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: HeartbeatStatus = "idle";
  private listeners = new Set<(s: HeartbeatStatus) => void>();

  constructor(options: HeartbeatMonitorOptions = {}) {
    this.intervalMs = options.intervalMs ?? 5_000;
    this.staleAfterMs = options.staleAfterMs ?? 15_000;
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.evaluate(), this.intervalMs);
    if (typeof (this.timer as { unref?: () => void }).unref === "function") {
      (this.timer as { unref: () => void }).unref();
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  tick(id: string): void {
    this.lastTick = { id, receivedAt: Date.now() };
    this.setStatus("healthy");
  }

  evaluate(): HeartbeatStatus {
    if (this.lastTick === null) {
      this.setStatus("idle");
      return this.status;
    }
    const age = Date.now() - this.lastTick.receivedAt;
    this.setStatus(age > this.staleAfterMs ? "stale" : "healthy");
    return this.status;
  }

  getStatus(): HeartbeatStatus {
    return this.status;
  }

  onStatus(listener: (s: HeartbeatStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(next: HeartbeatStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const l of this.listeners) {
      try { l(next); } catch { /* listener errors suppressed */ }
    }
  }
}
