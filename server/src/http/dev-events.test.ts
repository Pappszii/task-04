import { describe, expect, it } from 'vitest';
import { parseWorldEvent } from './dev-events.js';

const valid = { category: 'markets', title: ' ACME drops ', severity: 3 };
const now = new Date('2026-01-01T00:00:00.000Z');

describe('parseWorldEvent', () => {
  it('accepts a minimal event and fills in defaults', () => {
    const result = parseWorldEvent(valid, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event).toMatchObject({
      category: 'markets',
      title: 'ACME drops',
      summary: '',
      severity: 3,
      tags: [],
      occurredAt: '2026-01-01T00:00:00.000Z',
      source: 'dev',
    });
    expect(result.event.id).toBeTruthy();
    expect(result.event).not.toHaveProperty('symbol');
    expect(result.event).not.toHaveProperty('percentChange');
  });

  it('keeps optional market fields and a supplied id', () => {
    const result = parseWorldEvent({ ...valid, id: 'evt-9', symbol: 'ACME', percentChange: -4.2, tags: ['x'] }, now);

    expect(result.ok && result.event).toMatchObject({ id: 'evt-9', symbol: 'ACME', percentChange: -4.2, tags: ['x'] });
  });

  it.each([
    ['a non-object body', 'nope', /JSON object/],
    ['an array body', [], /JSON object/],
    ['a missing category', { ...valid, category: undefined }, /category/],
    ['an unknown category', { ...valid, category: 'sports' }, /category/],
    ['a blank title', { ...valid, title: '  ' }, /title/],
    ['a non-string summary', { ...valid, summary: 5 }, /summary/],
    ['severity 0', { ...valid, severity: 0 }, /severity/],
    ['severity 6', { ...valid, severity: 6 }, /severity/],
    ['a fractional severity', { ...valid, severity: 2.5 }, /severity/],
    ['a string severity', { ...valid, severity: '3' }, /severity/],
    ['non-string tags', { ...valid, tags: [1] }, /tags/],
    ['a non-string symbol', { ...valid, symbol: 1 }, /symbol/],
    ['a non-numeric percentChange', { ...valid, percentChange: '4' }, /percentChange/],
    ['a bad occurredAt', { ...valid, occurredAt: 'yesterday' }, /occurredAt/],
    ['an empty id', { ...valid, id: '' }, /id/],
  ])('rejects %s', (_label, body, message) => {
    const result = parseWorldEvent(body, now);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(message);
  });

  it('reports every problem at once', () => {
    const result = parseWorldEvent({ category: 'x', title: '', severity: 9 }, now);

    expect(!result.ok && result.errors).toHaveLength(3);
  });
});
