import type { AlertRule, WorldEvent } from '../domain/index.js';

/** Pure: decides whether an event should trigger a rule. Says nothing about delivery. */
export function matchesRule(event: WorldEvent, rule: AlertRule): boolean {
  if (!rule.enabled) return false;
  if (event.category !== rule.category) return false;
  if (event.severity < rule.minSeverity) return false;
  if (!matchesKeywords(event, rule.keywords)) return false;
  if (rule.category === 'markets' && !matchesMarket(event, rule)) return false;
  return true;
}

function matchesKeywords(event: WorldEvent, keywords: string[]): boolean {
  const needles = keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0);
  if (needles.length === 0) return true;
  const haystacks = [event.title, event.summary, ...event.tags].map((s) => s.toLowerCase());
  return needles.some((needle) => haystacks.some((h) => h.includes(needle)));
}

function matchesMarket(event: WorldEvent, rule: AlertRule): boolean {
  if (rule.symbol && event.symbol?.toLowerCase() !== rule.symbol.toLowerCase()) return false;
  if (rule.minPercentMove !== undefined) {
    if (event.percentChange === undefined) return false;
    if (Math.abs(event.percentChange) < rule.minPercentMove) return false;
  }
  return true;
}
