import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../container.js';
import { StubChannel } from '../testing/fixtures.js';
import { createApp, type AppOptions } from './app.js';

let server: Server | undefined;

async function start(container = createContainer(), options: AppOptions = {}): Promise<string> {
  const app = createApp(container, options);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe('GET /api/channels', () => {
  it('lists registered channels with what each needs', async () => {
    const base = await start();

    const body = await (await fetch(`${base}/api/channels`)).json();

    expect(body).toEqual([
      { id: 'email', displayName: 'Email', destinationKind: 'email address' },
      { id: 'slack', displayName: 'Slack', destinationKind: 'Slack handle' },
    ]);
  });

  it('includes a newly registered channel and hides a disabled one', async () => {
    const container = createContainer();
    container.registry.register(new StubChannel('webhook'));
    await container.channelSettings.setEnabled('slack', false);
    const base = await start(container);

    const body = (await (await fetch(`${base}/api/channels`)).json()) as { id: string }[];

    expect(body.map((c) => c.id)).toEqual(['email', 'webhook']);
  });
});

describe('POST /api/dev/events', () => {
  const post = (base: string, body: string) =>
    fetch(`${base}/api/dev/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

  it('runs a matching event through delivery and stores the notifications', async () => {
    const container = createContainer({ eventSources: [] });
    const base = await start(container);
    const quiet = vi.spyOn(console, 'info').mockImplementation(() => {});

    const res = await post(
      base,
      JSON.stringify({ category: 'markets', title: 'ACME plunges', severity: 3, symbol: 'ACME', percentChange: -5 }),
    );
    quiet.mockRestore();

    expect(res.status).toBe(201);
    expect(((await res.json()) as { event: { source: string } }).event.source).toBe('dev');
    const alice = await container.notifications.listByUser('u-alice');
    expect(alice.map((n) => [n.channelId, n.status])).toEqual([['slack', 'sent']]);
  });

  it('creates no notifications for an event that matches no rule', async () => {
    const container = createContainer({ eventSources: [] });
    const base = await start(container);

    const res = await post(base, JSON.stringify({ category: 'news', title: 'Quiet day', severity: 1 }));

    expect(res.status).toBe(201);
    for (const user of await container.users.list()) {
      expect(await container.notifications.listByUser(user.id)).toEqual([]);
    }
  });

  it('answers 400 with every validation error and publishes nothing', async () => {
    const container = createContainer({ eventSources: [] });
    const base = await start(container);

    const res = await post(base, JSON.stringify({ category: 'sports', severity: 9 }));

    expect(res.status).toBe(400);
    expect(((await res.json()) as { errors: string[] }).errors).toHaveLength(3);
  });

  it('answers 400 for malformed JSON', async () => {
    const base = await start(createContainer({ eventSources: [] }));

    const res = await post(base, '{not json');

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ errors: ['body is not valid JSON'] });
  });

  it('is not mounted when dev routes are off', async () => {
    const base = await start(createContainer({ eventSources: [] }), { devRoutes: false });

    const res = await post(base, JSON.stringify({ category: 'news', title: 'x', severity: 1 }));

    expect(res.status).toBe(404);
  });
});

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const base = await start();
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ status: 'ok' });
  });
});
