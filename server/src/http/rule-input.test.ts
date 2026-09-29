import { describe, expect, it } from 'vitest';
import { parseRuleInput } from './rule-input.js';

const channels = new Set(['email', 'slack']);
const valid = { category: 'disasters', channelIds: ['email'] };

describe('parseRuleInput', () => {
  it('accepts the minimum (category and one channel) and fills in defaults', () => {
    expect(parseRuleInput(valid, channels)).toEqual({
      ok: true,
      rule: {
        name: 'Disasters alert',
        category: 'disasters',
        keywords: [],
        minSeverity: 1,
        channelIds: ['email'],
        enabled: true,
      },
    });
  });

  it('trims the name and keywords, drops blank keywords, and dedupes channels', () => {
    const result = parseRuleInput(
      { ...valid, name: '  Quakes ', keywords: [' quake ', '', '  '], channelIds: ['email', 'slack', 'email'] },
      channels,
    );

    expect(result.ok && result.rule).toMatchObject({
      name: 'Quakes',
      keywords: ['quake'],
      channelIds: ['email', 'slack'],
    });
  });

  it('keeps market fields for markets, uppercasing the symbol', () => {
    const result = parseRuleInput(
      { ...valid, category: 'markets', symbol: ' acme ', minPercentMove: 2.5 },
      channels,
    );

    expect(result.ok && result.rule).toMatchObject({ symbol: 'ACME', minPercentMove: 2.5 });
  });

  it('treats null and blank market fields as not set', () => {
    const result = parseRuleInput({ ...valid, category: 'markets', symbol: ' ', minPercentMove: null }, channels);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rule).not.toHaveProperty('symbol');
    expect(result.rule).not.toHaveProperty('minPercentMove');
  });

  it('drops market fields for other categories, even invalid ones', () => {
    const result = parseRuleInput({ ...valid, category: 'news', symbol: 5, minPercentMove: 'x' }, channels);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rule).not.toHaveProperty('symbol');
    expect(result.rule).not.toHaveProperty('minPercentMove');
  });

  it.each([
    ['a non-object body', null, /JSON object/],
    ['no category', { channelIds: ['email'] }, /category/],
    ['an unknown category', { ...valid, category: 'sports' }, /category/],
    ['no channels', { category: 'news' }, /at least one channel/],
    ['an empty channel list', { ...valid, channelIds: [] }, /at least one channel/],
    ['an unknown channel', { ...valid, channelIds: ['fax'] }, /unknown channel: fax/],
    ['a non-string name', { ...valid, name: 3 }, /name/],
    ['a name that is too long', { ...valid, name: 'x'.repeat(101) }, /name/],
    ['non-string keywords', { ...valid, keywords: [1] }, /keywords/],
    ['severity 0', { ...valid, minSeverity: 0 }, /minSeverity/],
    ['severity 6', { ...valid, minSeverity: 6 }, /minSeverity/],
    ['a fractional severity', { ...valid, minSeverity: 2.5 }, /minSeverity/],
    ['a non-boolean enabled', { ...valid, enabled: 'yes' }, /enabled/],
    ['a non-string market symbol', { ...valid, category: 'markets', symbol: 5 }, /symbol/],
    ['a negative percent move', { ...valid, category: 'markets', minPercentMove: -1 }, /minPercentMove/],
    ['a string percent move', { ...valid, category: 'markets', minPercentMove: '3' }, /minPercentMove/],
  ])('rejects %s', (_label, body, message) => {
    const result = parseRuleInput(body, channels);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(message);
  });

  it('reports every problem at once', () => {
    const result = parseRuleInput({ category: 'x', channelIds: [], minSeverity: 9 }, channels);

    expect(!result.ok && result.errors).toHaveLength(3);
  });
});
