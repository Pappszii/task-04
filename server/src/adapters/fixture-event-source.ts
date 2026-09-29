import { randomUUID } from 'node:crypto';
import type { WorldEvent } from '../domain/index.js';
import type { EventSource } from '../ports/index.js';

/** An event before the source stamps it with an id, time and source name. */
export type EventFixture = Omit<WorldEvent, 'id' | 'occurredAt' | 'source'>;

export interface FixtureSourceOptions {
  /** Time between events after the first. */
  intervalMs?: number;
  /** Time before the first event, so several sources don't fire together. */
  initialDelayMs?: number;
  now?: () => Date;
  newId?: () => string;
}

export interface FixtureEventSourceConfig extends FixtureSourceOptions {
  name: string;
  fixtures: readonly EventFixture[];
}

/** Emits its fixtures in a loop on a timer. Makes no network calls. */
export class FixtureEventSource implements EventSource {
  private readonly listeners = new Set<(event: WorldEvent) => void>();
  private readonly name: string;
  private readonly fixtures: readonly EventFixture[];
  private readonly intervalMs: number;
  private readonly initialDelayMs: number;
  private readonly now: () => Date;
  private readonly newId: () => string;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private next = 0;

  constructor(config: FixtureEventSourceConfig) {
    if (config.fixtures.length === 0) throw new Error(`${config.name}: needs at least one fixture`);
    this.name = config.name;
    this.fixtures = config.fixtures;
    this.intervalMs = config.intervalMs ?? 15_000;
    this.initialDelayMs = config.initialDelayMs ?? this.intervalMs;
    this.now = config.now ?? (() => new Date());
    this.newId = config.newId ?? randomUUID;
  }

  start(): void {
    if (this.timer) return;
    this.schedule(this.initialDelayMs);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  onEvent(callback: (event: WorldEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private schedule(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.emit();
      this.schedule(this.intervalMs);
    }, delayMs);
    // Never keep the process alive just for a demo feed.
    this.timer.unref?.();
  }

  private emit(): void {
    const fixture = this.fixtures[this.next % this.fixtures.length]!;
    this.next += 1;
    const event: WorldEvent = {
      ...structuredClone(fixture),
      id: this.newId(),
      occurredAt: this.now().toISOString(),
      source: this.name,
    };
    for (const listener of this.listeners) listener(event);
  }
}
