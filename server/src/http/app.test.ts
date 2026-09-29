import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, type Container } from '../container.js';
import { StubChannel } from '../testing/fixtures.js';
import { apiClient, startServer, type TestServer } from '../testing/http.js';
import type { AppOptions } from './app.js';

let server: TestServer | undefined;

async function start(container: Container = createContainer({ eventSources: [] }), options: AppOptions = {}) {
  server = await startServer(container, options);
  return server.base;
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(async () => {
  await server?.close();
  server = undefined;
  vi.restoreAllMocks();
});

describe('public routes', () => {
  it('GET /api/health reports ok', async () => {
    const api = apiClient(await start());
    expect(await api('GET', '/api/health')).toEqual({ status: 200, body: { status: 'ok' } });
  });

  it('GET /api/demo-users lists the seeded users without their contacts', async () => {
    const api = apiClient(await start());

    const { status, body } = await api('GET', '/api/demo-users');

    expect(status).toBe(200);
    expect(body).toEqual([
      { id: 'u-alice', name: 'Alice', role: 'user' },
      { id: 'u-bob', name: 'Bob', role: 'user' },
      { id: 'u-carol', name: 'Carol', role: 'user' },
      { id: 'u-admin', name: 'Admin', role: 'admin' },
    ]);
  });

  describe('GET /api/channels', () => {
    // Expectations come from the registry, so registering another channel needs no change here.
    it('lists every registered channel with what each needs', async () => {
      const container = createContainer({ eventSources: [] });
      const api = apiClient(await start(container));

      const { body } = await api('GET', '/api/channels');

      expect(body).toEqual(
        container.registry.list().map(({ id, displayName, destinationKind }) => ({ id, displayName, destinationKind })),
      );
      expect(body).toContainEqual({ id: 'email', displayName: 'Email', destinationKind: 'email address' });
    });

    it('includes a newly registered channel and hides a disabled one', async () => {
      const container = createContainer({ eventSources: [] });
      container.registry.register(new StubChannel('pager'));
      await container.channelSettings.setEnabled('slack', false);
      const api = apiClient(await start(container));

      const ids = (await api<{ id: string }[]>('GET', '/api/channels')).body.map((c) => c.id);

      expect(ids).toContain('pager');
      expect(ids).toContain('email');
      expect(ids).not.toContain('slack');
    });
  });
});

describe('demo identity', () => {
  it('answers 401 without X-Demo-User', async () => {
    const api = apiClient(await start());

    expect(await api('GET', '/api/me')).toEqual({ status: 401, body: { error: 'missing X-Demo-User header' } });
  });

  it('answers 401 for an unknown user', async () => {
    const api = apiClient(await start(), 'u-nobody');

    expect(await api('GET', '/api/me')).toEqual({ status: 401, body: { error: 'unknown demo user "u-nobody"' } });
  });

  it('does not accept ?userId= outside the stream', async () => {
    const api = apiClient(await start());

    expect((await api('GET', '/api/me?userId=u-alice')).status).toBe(401);
  });

  it('answers 404 JSON for an unknown API route', async () => {
    const api = apiClient(await start(), 'u-alice');

    expect(await api('GET', '/api/nope')).toEqual({ status: 404, body: { error: 'not found' } });
  });
});

describe('POST /api/dev/events', () => {
  it('runs a matching event through delivery and stores the notifications', async () => {
    const container = createContainer({ eventSources: [] });
    const api = apiClient(await start(container));

    const { status, body } = await api<{ event: { source: string } }>('POST', '/api/dev/events', {
      category: 'markets',
      title: 'ACME plunges',
      severity: 3,
      symbol: 'ACME',
      percentChange: -5,
    });

    expect(status).toBe(201);
    expect(body.event.source).toBe('dev');
    const alice = await container.notifications.listByUser('u-alice');
    expect(alice.map((n) => [n.channelId, n.status])).toEqual([['slack', 'sent']]);
  });

  it('creates no notifications for an event that matches no rule', async () => {
    const container = createContainer({ eventSources: [] });
    const api = apiClient(await start(container));

    const { status } = await api('POST', '/api/dev/events', { category: 'news', title: 'Quiet day', severity: 1 });

    expect(status).toBe(201);
    for (const user of await container.users.list()) {
      expect(await container.notifications.listByUser(user.id)).toEqual([]);
    }
  });

  it('answers 400 with every validation error', async () => {
    const api = apiClient(await start());

    const { status, body } = await api<{ errors: string[] }>('POST', '/api/dev/events', {
      category: 'sports',
      severity: 9,
    });

    expect(status).toBe(400);
    expect(body.errors).toHaveLength(3);
  });

  it('answers 400 for malformed JSON', async () => {
    const api = apiClient(await start());

    expect(await api('POST', '/api/dev/events', '{not json')).toEqual({
      status: 400,
      body: { errors: ['body is not valid JSON'] },
    });
  });

  it('is not mounted when dev routes are off', async () => {
    const api = apiClient(await start(undefined, { devRoutes: false }), 'u-alice');

    const { status } = await api('POST', '/api/dev/events', { category: 'news', title: 'x', severity: 1 });

    expect(status).toBe(404);
  });
});
