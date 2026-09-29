import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, type Container } from '../../container.js';
import type { ChannelState } from '../../domain/index.js';
import { StubChannel } from '../../testing/fixtures.js';
import { apiClient, startServer, type TestServer } from '../../testing/http.js';

let container: Container;
let server: TestServer;
const as = (user?: string) => apiClient(server.base, user);

beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  container = createContainer({ eventSources: [] });
  server = await startServer(container);
});

afterEach(async () => {
  await server.close();
  vi.restoreAllMocks();
});

describe('admin guard (AC12)', () => {
  it.each([
    ['GET', '/api/admin/channels', undefined],
    ['PATCH', '/api/admin/channels/slack', { enabled: false }],
    ['GET', '/api/admin/anything', undefined],
  ] as const)('%s %s answers 403 for a non-admin', async (method, path, body) => {
    expect(await as('u-alice')(method, path, body)).toEqual({ status: 403, body: { error: 'admin only' } });
  });

  it('a non-admin PATCH changes nothing', async () => {
    await as('u-alice')('PATCH', '/api/admin/channels/slack', { enabled: false });

    expect(await container.channelSettings.isEnabled('slack')).toBe(true);
  });

  it('answers 401 before 403 when there is no user', async () => {
    expect((await as()('GET', '/api/admin/channels')).status).toBe(401);
  });
});

describe('GET /api/admin/channels', () => {
  it('lists every registered channel with its enabled flag, including disabled ones', async () => {
    await container.channelSettings.setEnabled('slack', false);

    expect(await as('u-admin')('GET', '/api/admin/channels')).toEqual({
      status: 200,
      body: [
        { id: 'email', displayName: 'Email', destinationKind: 'email address', enabled: true },
        { id: 'slack', displayName: 'Slack', destinationKind: 'Slack handle', enabled: false },
      ],
    });
  });

  it('includes a newly registered channel automatically (AC10)', async () => {
    container.registry.register(new StubChannel('webhook'));

    const { body } = await as('u-admin')<{ id: string }[]>('GET', '/api/admin/channels');

    expect(body.map((c) => c.id)).toEqual(['email', 'slack', 'webhook']);
  });
});

describe('PATCH /api/admin/channels/:id', () => {
  it('disables a channel and returns its new state', async () => {
    const res = await as('u-admin')('PATCH', '/api/admin/channels/slack', { enabled: false });

    expect(res).toEqual({
      status: 200,
      body: { id: 'slack', displayName: 'Slack', destinationKind: 'Slack handle', enabled: false },
    });
    expect(await container.channelSettings.isEnabled('slack')).toBe(false);
  });

  it('publishes the change for SSE subscribers', async () => {
    const seen: ChannelState[] = [];
    container.channelEvents.subscribe((state) => {
      seen.push(state);
    });

    await as('u-admin')('PATCH', '/api/admin/channels/email', { enabled: false });

    expect(seen).toEqual([{ channelId: 'email', enabled: false }]);
  });

  it('answers 404 for an unknown channel', async () => {
    expect(await as('u-admin')('PATCH', '/api/admin/channels/fax', { enabled: false })).toEqual({
      status: 404,
      body: { error: 'unknown channel: fax' },
    });
  });

  it.each([[{}], [{ enabled: 'no' }], [[false]]])('answers 400 for body %j', async (body) => {
    const res = await as('u-admin')('PATCH', '/api/admin/channels/slack', body);

    expect(res).toEqual({ status: 400, body: { errors: ['enabled must be a boolean'] } });
    expect(await container.channelSettings.isEnabled('slack')).toBe(true);
  });
});

describe('disabling a channel end to end (AC13)', () => {
  const quake = { category: 'disasters', title: 'Quake', severity: 5 };

  it('hides it from the picker, skips its deliveries, and restores both on re-enable', async () => {
    await as('u-admin')('PATCH', '/api/admin/channels/slack', { enabled: false });

    const picker = await as('u-alice')<{ id: string }[]>('GET', '/api/channels');
    expect(picker.body.map((c) => c.id)).toEqual(['email']);

    await as()('POST', '/api/dev/events', quake);
    const whileDisabled = await container.notifications.listByUser('u-alice');
    expect(whileDisabled.find((n) => n.channelId === 'slack')).toMatchObject({
      status: 'skipped',
      reason: 'channel disabled',
    });
    expect(whileDisabled.find((n) => n.channelId === 'email')).toMatchObject({ status: 'sent' });

    await as('u-admin')('PATCH', '/api/admin/channels/slack', { enabled: true });

    const restored = await as('u-alice')<{ id: string }[]>('GET', '/api/channels');
    expect(restored.body.map((c) => c.id)).toEqual(['email', 'slack']);
    await as()('POST', '/api/dev/events', quake);
    const [latestSlack] = (await container.notifications.listByUser('u-alice')).filter(
      (n) => n.channelId === 'slack',
    );
    expect(latestSlack).toMatchObject({ status: 'sent' });
  });

  it('keeps the rule unchanged while the channel is disabled', async () => {
    const before = await container.rules.getById('r-alice-quakes');

    await as('u-admin')('PATCH', '/api/admin/channels/slack', { enabled: false });

    expect(await container.rules.getById('r-alice-quakes')).toEqual(before);
  });
});
