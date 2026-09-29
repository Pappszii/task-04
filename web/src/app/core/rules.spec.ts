import { describe, expect, it } from 'vitest';
import { makeRule } from '../testing/fakes';
import { parseKeywords, toRuleInput } from './rules';

describe('parseKeywords', () => {
  it('splits on commas, trims, drops blanks and case-insensitive duplicates', () => {
    expect(parseKeywords(' flood, Fire ,, FLOOD,fire , ')).toEqual(['flood', 'Fire']);
  });

  it('returns nothing for blank input', () => {
    expect(parseKeywords('')).toEqual([]);
    expect(parseKeywords(' , ')).toEqual([]);
  });
});

describe('toRuleInput', () => {
  it('keeps every editable field and turns missing market fields into null', () => {
    expect(toRuleInput(makeRule({ keywords: ['x'] }))).toEqual({
      name: 'Serious disasters',
      category: 'disasters',
      keywords: ['x'],
      minSeverity: 4,
      symbol: null,
      minPercentMove: null,
      channelIds: ['email'],
      enabled: true,
    });
  });

  it('keeps market fields', () => {
    const input = toRuleInput(makeRule({ category: 'markets', symbol: 'ACME', minPercentMove: 0 }));

    expect(input).toMatchObject({ symbol: 'ACME', minPercentMove: 0 });
  });
});
