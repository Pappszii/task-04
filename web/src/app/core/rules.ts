import type { AlertRule, AlertRuleInput } from './models';

/** The body to send to replace `rule` unchanged, e.g. before flipping one field. */
export function toRuleInput(rule: AlertRule): AlertRuleInput {
  return {
    name: rule.name,
    category: rule.category,
    keywords: rule.keywords,
    minSeverity: rule.minSeverity,
    symbol: rule.symbol ?? null,
    minPercentMove: rule.minPercentMove ?? null,
    channelIds: rule.channelIds,
    enabled: rule.enabled,
  };
}

/** Splits "flood, Fire ,, flood" into ["flood", "Fire"]: trimmed, blanks dropped, case-insensitive dedupe. */
export function parseKeywords(text: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const raw of text.split(',')) {
    const keyword = raw.trim();
    if (!keyword || seen.has(keyword.toLowerCase())) continue;
    seen.add(keyword.toLowerCase());
    keywords.push(keyword);
  }
  return keywords;
}
