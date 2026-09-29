import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeEvent } from '../testing/fixtures.js';
import { MockWebhookChannel } from './mock-webhook-channel.js';

describe('MockWebhookChannel', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['https://example.com/hooks/alerts', { valid: true }],
    ['http://example.com/hooks', { valid: false, reason: 'the URL must start with https://' }],
    ['example.com/hooks', { valid: false, reason: 'expected a URL like https://example.com/hooks/alerts' }],
    ['@alice', { valid: false, reason: 'expected a URL like https://example.com/hooks/alerts' }],
  ])('validates %s', (destination, expected) => {
    expect(new MockWebhookChannel(() => {}).validateDestination(destination)).toEqual(expected);
  });

  it('builds the JSON request a real webhook would receive, logs it, and makes no network call', async () => {
    const log = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const channel = new MockWebhookChannel(log);
    const event = makeEvent({ category: 'markets', symbol: 'ACME', percentChange: -4.2 });

    const result = await channel.send({
      destination: 'https://example.com/hooks/alerts',
      subject: '[markets] ACME drops',
      body: 'ACME fell.',
      event,
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        method: 'POST',
        url: 'https://example.com/hooks/alerts',
        headers: { 'content-type': 'application/json' },
        body: {
          type: 'world-alert',
          subject: '[markets] ACME drops',
          text: 'ACME fell.',
          event: {
            id: event.id,
            category: 'markets',
            title: event.title,
            severity: event.severity,
            occurredAt: event.occurredAt,
            source: event.source,
            symbol: 'ACME',
            percentChange: -4.2,
          },
        },
      },
    });
    expect(log).toHaveBeenCalledWith('[mock-webhook] would POST', result.ok && result.payload);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('leaves market fields out for other events', async () => {
    const result = await new MockWebhookChannel(() => {}).send({
      destination: 'https://example.com/h',
      subject: 's',
      body: 'b',
      event: makeEvent(),
    });

    const body = result.ok ? (result.payload['body'] as { event: Record<string, unknown> }) : undefined;
    expect(body?.event).not.toHaveProperty('symbol');
    expect(body?.event).not.toHaveProperty('percentChange');
  });
});
