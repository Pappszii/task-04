import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorldEvent } from '../domain/index.js';
import { matchesRule } from '../services/rule-matcher.js';
import { disasterFixtures, marketFixtures, newsFixtures } from './event-fixtures.js';
import { createMockEventSources, MockDisasterSource, MockMarketSource, MockNewsSource } from './mock-event-sources.js';
import { seedRules } from './seed.js';

const stamp = (fixture: (typeof newsFixtures)[number]): WorldEvent => ({
  ...fixture,
  id: 'x',
  occurredAt: '2026-01-01T00:00:00.000Z',
  source: 'test',
});

describe('fixtures', () => {
  it.each([
    ['news', newsFixtures],
    ['markets', marketFixtures],
    ['disasters', disasterFixtures],
  ] as const)('%s fixtures are all in their own category with a valid severity', (category, list) => {
    expect(list.length).toBeGreaterThan(0);
    for (const fixture of list) {
      expect(fixture.category).toBe(category);
      expect([1, 2, 3, 4, 5]).toContain(fixture.severity);
    }
  });

  it('market fixtures carry a symbol and a percent change', () => {
    for (const fixture of marketFixtures) {
      expect(fixture.symbol).toBeTruthy();
      expect(typeof fixture.percentChange).toBe('number');
    }
  });

  it('trigger every seeded rule at least once, and leave some events matching nothing', () => {
    const events = [...newsFixtures, ...marketFixtures, ...disasterFixtures].map(stamp);
    const rules = seedRules();

    for (const rule of rules) {
      expect(events.some((e) => matchesRule(e, rule)), `rule ${rule.id} never fires`).toBe(true);
    }
    expect(events.some((e) => !rules.some((r) => matchesRule(e, r)))).toBe(true);
  });
});

describe('mock sources', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('name themselves in the source field', () => {
    const seen: string[] = [];
    for (const Source of [MockNewsSource, MockMarketSource, MockDisasterSource]) {
      const source = new Source({ intervalMs: 100, initialDelayMs: 100 });
      source.onEvent((e) => seen.push(e.source));
      source.start();
    }
    vi.advanceTimersByTime(100);
    expect(seen.sort()).toEqual(['mock-disasters', 'mock-markets', 'mock-news']);
  });

  it('createMockEventSources staggers the first event of each feed within one interval', () => {
    const sources = createMockEventSources({ intervalMs: 1000 });
    const arrivals: [string, number][] = [];
    let elapsed = 0;
    for (const source of sources) {
      source.onEvent((e) => arrivals.push([e.source, elapsed]));
      source.start();
    }
    for (elapsed = 1; elapsed <= 1000; elapsed++) vi.advanceTimersByTime(1);

    expect(arrivals.map(([source]) => source)).toEqual(['mock-news', 'mock-markets', 'mock-disasters']);
    expect(arrivals.map(([, at]) => at)).toEqual([200, 400, 600]);
  });
});
