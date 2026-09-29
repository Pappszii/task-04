import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorldEvent } from '../domain/index.js';
import { FixtureEventSource, type EventFixture } from './fixture-event-source.js';

const fixtures: EventFixture[] = [
  { category: 'news', title: 'one', summary: '', severity: 1, tags: [] },
  { category: 'news', title: 'two', summary: '', severity: 2, tags: [] },
];

function makeSource(overrides: { intervalMs?: number; initialDelayMs?: number } = {}) {
  let id = 0;
  return new FixtureEventSource({
    name: 'test-source',
    fixtures,
    intervalMs: 1000,
    initialDelayMs: 300,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    newId: () => `id-${++id}`,
    ...overrides,
  });
}

describe('FixtureEventSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits nothing until started, then first after the initial delay and the rest on the interval', () => {
    const source = makeSource();
    const seen: WorldEvent[] = [];
    source.onEvent((e) => seen.push(e));

    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([]);

    source.start();
    vi.advanceTimersByTime(299);
    expect(seen).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(seen).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(seen).toHaveLength(2);
  });

  it('stamps id, time and source, and loops through the fixtures', () => {
    const source = makeSource();
    const seen: WorldEvent[] = [];
    source.onEvent((e) => seen.push(e));
    source.start();

    vi.advanceTimersByTime(300 + 1000 * 2);

    expect(seen.map((e) => e.title)).toEqual(['one', 'two', 'one']);
    expect(seen[0]).toMatchObject({
      id: 'id-1',
      source: 'test-source',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
    expect(new Set(seen.map((e) => e.id)).size).toBe(3);
  });

  it('stops emitting after stop() and can be restarted', () => {
    const source = makeSource();
    const seen: WorldEvent[] = [];
    source.onEvent((e) => seen.push(e));

    source.start();
    vi.advanceTimersByTime(300);
    source.stop();
    vi.advanceTimersByTime(5000);
    expect(seen).toHaveLength(1);

    source.start();
    vi.advanceTimersByTime(300);
    expect(seen).toHaveLength(2);
  });

  it('does not double up when started twice', () => {
    const source = makeSource();
    const seen: WorldEvent[] = [];
    source.onEvent((e) => seen.push(e));

    source.start();
    source.start();
    vi.advanceTimersByTime(300);

    expect(seen).toHaveLength(1);
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const source = makeSource();
    const listener = vi.fn();
    const unsubscribe = source.onEvent(listener);
    unsubscribe();

    source.start();
    vi.advanceTimersByTime(300);

    expect(listener).not.toHaveBeenCalled();
  });

  it('does not let listeners mutate the fixtures', () => {
    const source = makeSource();
    source.onEvent((e) => e.tags.push('mutated'));
    source.start();
    vi.advanceTimersByTime(300 + 1000 * 2);

    expect(fixtures[0]?.tags).toEqual([]);
  });

  it('rejects an empty fixture list', () => {
    expect(() => new FixtureEventSource({ name: 'empty', fixtures: [] })).toThrow(/at least one fixture/);
  });
});
