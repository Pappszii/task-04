import type { ChannelRegistry } from '../services/channel-registry.js';
import { isObject } from './validation.js';

/** Channel id to its new destination, or `null` to clear it. */
export type ContactUpdates = Record<string, string | null>;

export type ParsedContacts = { ok: true; updates: ContactUpdates } | { ok: false; errors: string[] };

/**
 * Validates `{ [channelId]: destination }`. Each destination is checked by its own channel.
 * An empty string or `null` clears that destination.
 */
export function parseContactsInput(body: unknown, registry: ChannelRegistry): ParsedContacts {
  if (!isObject(body)) {
    return { ok: false, errors: ['body must be a JSON object of channel id to destination'] };
  }
  const errors: string[] = [];
  const updates: ContactUpdates = {};

  for (const [channelId, value] of Object.entries(body)) {
    const channel = registry.get(channelId);
    if (!channel) {
      errors.push(`unknown channel: ${channelId}`);
      continue;
    }
    if (value !== null && typeof value !== 'string') {
      errors.push(`${channel.displayName}: destination must be a string`);
      continue;
    }
    const destination = value?.trim() ?? '';
    if (destination === '') {
      updates[channelId] = null;
      continue;
    }
    const validation = channel.validateDestination(destination);
    if (!validation.valid) {
      errors.push(`${channel.displayName}: ${validation.reason}`);
      continue;
    }
    updates[channelId] = destination;
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, updates };
}

/** Channels missing from `updates` keep their destination. */
export function applyContactUpdates(
  current: Record<string, string>,
  updates: ContactUpdates,
): Record<string, string> {
  const next = { ...current };
  for (const [channelId, destination] of Object.entries(updates)) {
    if (destination === null) delete next[channelId];
    else next[channelId] = destination;
  }
  return next;
}
