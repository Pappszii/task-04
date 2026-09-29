import { CATEGORIES, type AlertRule, type Category, type Severity } from '../domain/index.js';
import { isObject, isStringArray } from './validation.js';

export type RuleInput = Omit<AlertRule, 'id' | 'userId'>;

export type ParsedRule = { ok: true; rule: RuleInput } | { ok: false; errors: string[] };

const MAX_NAME_LENGTH = 100;

const CATEGORY_LABELS: Record<Category, string> = {
  news: 'News',
  markets: 'Markets',
  disasters: 'Disasters',
};

/**
 * Validates a rule sent by a client. Only `category` and at least one channel are required.
 * `symbol` and `minPercentMove` are markets-only and dropped for other categories; `null` clears them.
 */
export function parseRuleInput(body: unknown, knownChannelIds: ReadonlySet<string>): ParsedRule {
  if (!isObject(body)) return { ok: false, errors: ['body must be a JSON object'] };
  const errors: string[] = [];

  const category = body['category'];
  if (typeof category !== 'string' || !CATEGORIES.includes(category as Category)) {
    errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
  }

  const name = body['name'] ?? '';
  if (typeof name !== 'string' || name.trim().length > MAX_NAME_LENGTH) {
    errors.push(`name must be a string of at most ${MAX_NAME_LENGTH} characters`);
  }

  const keywords = body['keywords'] ?? [];
  if (!isStringArray(keywords)) errors.push('keywords must be an array of strings');

  const minSeverity = body['minSeverity'] ?? 1;
  if (!Number.isInteger(minSeverity) || (minSeverity as number) < 1 || (minSeverity as number) > 5) {
    errors.push('minSeverity must be an integer from 1 to 5');
  }

  const channelIds = body['channelIds'];
  if (!isStringArray(channelIds) || channelIds.length === 0) {
    errors.push('select at least one channel');
  } else {
    for (const id of new Set(channelIds)) {
      if (!knownChannelIds.has(id)) errors.push(`unknown channel: ${id}`);
    }
  }

  const enabled = body['enabled'] ?? true;
  if (typeof enabled !== 'boolean') errors.push('enabled must be a boolean');

  const isMarkets = category === 'markets';
  const symbol = isMarkets ? (body['symbol'] ?? '') : '';
  if (typeof symbol !== 'string') errors.push('symbol must be a string');

  const minPercentMove = isMarkets ? (body['minPercentMove'] ?? undefined) : undefined;
  if (
    minPercentMove !== undefined &&
    (typeof minPercentMove !== 'number' || !Number.isFinite(minPercentMove) || minPercentMove < 0)
  ) {
    errors.push('minPercentMove must be a number of at least 0');
  }

  if (errors.length > 0) return { ok: false, errors };

  const validCategory = category as Category;
  const rule: RuleInput = {
    name: (name as string).trim() || `${CATEGORY_LABELS[validCategory]} alert`,
    category: validCategory,
    keywords: (keywords as string[]).map((k) => k.trim()).filter((k) => k.length > 0),
    minSeverity: minSeverity as Severity,
    channelIds: [...new Set(channelIds as string[])],
    enabled: enabled as boolean,
  };
  const normalizedSymbol = (symbol as string).trim().toUpperCase();
  if (normalizedSymbol) rule.symbol = normalizedSymbol;
  if (minPercentMove !== undefined) rule.minPercentMove = minPercentMove as number;
  return { ok: true, rule };
}
