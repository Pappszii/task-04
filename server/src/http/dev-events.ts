import { randomUUID } from 'node:crypto';
import { CATEGORIES, type Category, type Severity, type WorldEvent } from '../domain/index.js';

export type ParsedEvent = { ok: true; event: WorldEvent } | { ok: false; errors: string[] };

/** Validates a hand-posted event. `id`, `occurredAt` and `source` are optional and filled in. */
export function parseWorldEvent(body: unknown, now: Date = new Date()): ParsedEvent {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: ['body must be a JSON object'] };
  }
  const input = body as Record<string, unknown>;
  const errors: string[] = [];

  const category = input['category'];
  if (typeof category !== 'string' || !CATEGORIES.includes(category as Category)) {
    errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
  }

  const title = input['title'];
  if (typeof title !== 'string' || title.trim() === '') errors.push('title is required');

  const summary = input['summary'] ?? '';
  if (typeof summary !== 'string') errors.push('summary must be a string');

  const severity = input['severity'];
  if (!Number.isInteger(severity) || (severity as number) < 1 || (severity as number) > 5) {
    errors.push('severity must be an integer from 1 to 5');
  }

  const tags = input['tags'] ?? [];
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) {
    errors.push('tags must be an array of strings');
  }

  const symbol = input['symbol'];
  if (symbol !== undefined && typeof symbol !== 'string') errors.push('symbol must be a string');

  const percentChange = input['percentChange'];
  if (percentChange !== undefined && !Number.isFinite(percentChange)) {
    errors.push('percentChange must be a number');
  }

  const id = input['id'] ?? randomUUID();
  if (typeof id !== 'string' || id === '') errors.push('id must be a non-empty string');

  const occurredAt = input['occurredAt'] ?? now.toISOString();
  if (typeof occurredAt !== 'string' || Number.isNaN(Date.parse(occurredAt))) {
    errors.push('occurredAt must be an ISO date string');
  }

  const source = input['source'] ?? 'dev';
  if (typeof source !== 'string' || source === '') errors.push('source must be a non-empty string');

  if (errors.length > 0) return { ok: false, errors };

  const event: WorldEvent = {
    id: id as string,
    category: category as Category,
    title: (title as string).trim(),
    summary: summary as string,
    severity: severity as Severity,
    tags: tags as string[],
    occurredAt: occurredAt as string,
    source: source as string,
  };
  if (symbol !== undefined) event.symbol = symbol as string;
  if (percentChange !== undefined) event.percentChange = percentChange as number;
  return { ok: true, event };
}
