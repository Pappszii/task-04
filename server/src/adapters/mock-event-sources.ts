import type { EventSource } from '../ports/index.js';
import { disasterFixtures, marketFixtures, newsFixtures } from './event-fixtures.js';
import { FixtureEventSource, type FixtureSourceOptions } from './fixture-event-source.js';

export class MockNewsSource extends FixtureEventSource {
  constructor(options: FixtureSourceOptions = {}) {
    super({ ...options, name: 'mock-news', fixtures: newsFixtures });
  }
}

export class MockMarketSource extends FixtureEventSource {
  constructor(options: FixtureSourceOptions = {}) {
    super({ ...options, name: 'mock-markets', fixtures: marketFixtures });
  }
}

export class MockDisasterSource extends FixtureEventSource {
  constructor(options: FixtureSourceOptions = {}) {
    super({ ...options, name: 'mock-disasters', fixtures: disasterFixtures });
  }
}

/** The three demo feeds, staggered so their events arrive one after another. */
export function createMockEventSources(options: { intervalMs?: number } = {}): EventSource[] {
  const intervalMs = options.intervalMs ?? 15_000;
  const stagger = (index: number): FixtureSourceOptions => ({
    intervalMs,
    initialDelayMs: Math.round((intervalMs / 5) * (index + 1)),
  });
  return [
    new MockNewsSource(stagger(0)),
    new MockMarketSource(stagger(1)),
    new MockDisasterSource(stagger(2)),
  ];
}
