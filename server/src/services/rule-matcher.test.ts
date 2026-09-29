import { describe, expect, it } from 'vitest';
import { makeEvent, makeRule } from '../testing/fixtures.js';
import { matchesRule } from './rule-matcher.js';

describe('matchesRule', () => {
  it('matches on category and severity', () => {
    expect(matchesRule(makeEvent({ severity: 4 }), makeRule({ minSeverity: 4 }))).toBe(true);
    expect(matchesRule(makeEvent({ severity: 3 }), makeRule({ minSeverity: 4 }))).toBe(false);
  });

  it('rejects a different category', () => {
    expect(matchesRule(makeEvent({ category: 'news' }), makeRule({ category: 'disasters' }))).toBe(false);
  });

  it('never matches a disabled rule', () => {
    expect(matchesRule(makeEvent(), makeRule({ enabled: false }))).toBe(false);
  });

  describe('keywords', () => {
    it('matches everything when no keywords are set', () => {
      expect(matchesRule(makeEvent(), makeRule({ keywords: [] }))).toBe(true);
      expect(matchesRule(makeEvent(), makeRule({ keywords: ['  ', ''] }))).toBe(true);
    });

    it('matches case-insensitively on title, summary or tags', () => {
      expect(matchesRule(makeEvent(), makeRule({ keywords: ['EARTHQUAKE'] }))).toBe(true);
      expect(matchesRule(makeEvent(), makeRule({ keywords: ['offshore'] }))).toBe(true);
      expect(matchesRule(makeEvent(), makeRule({ keywords: ['pacif'] }))).toBe(true);
    });

    it('matches when any one keyword hits', () => {
      expect(matchesRule(makeEvent(), makeRule({ keywords: ['volcano', 'coast'] }))).toBe(true);
    });

    it('rejects when no keyword hits', () => {
      expect(matchesRule(makeEvent(), makeRule({ keywords: ['volcano'] }))).toBe(false);
    });
  });

  describe('markets', () => {
    const market = makeEvent({ category: 'markets', symbol: 'ACME', percentChange: -4.2 });
    const rule = { category: 'markets' as const };

    it('filters by symbol, ignoring case', () => {
      expect(matchesRule(market, makeRule({ ...rule, symbol: 'acme' }))).toBe(true);
      expect(matchesRule(market, makeRule({ ...rule, symbol: 'OTHER' }))).toBe(false);
    });

    it('filters by minimum percent move using the absolute value', () => {
      expect(matchesRule(market, makeRule({ ...rule, minPercentMove: 4 }))).toBe(true);
      expect(matchesRule(market, makeRule({ ...rule, minPercentMove: 5 }))).toBe(false);
    });

    it('does not match an event without a percent change when a threshold is set', () => {
      const noMove = makeEvent({ category: 'markets', symbol: 'ACME' });
      expect(matchesRule(noMove, makeRule({ ...rule, minPercentMove: 1 }))).toBe(false);
    });

    it('ignores market fields on other categories', () => {
      const rule = makeRule({ category: 'news', symbol: 'ACME', minPercentMove: 10 });
      expect(matchesRule(makeEvent({ category: 'news' }), rule)).toBe(true);
    });
  });
});
