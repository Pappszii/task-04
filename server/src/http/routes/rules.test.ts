import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, type Container } from '../../container.js';
import type { AlertRule } from '../../domain/index.js';
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

const newRule = { name: 'Floods', category: 'disasters', keywords: ['flood'], minSeverity: 3, channelIds: ['email'] };

describe('GET /api/rules', () => {
  it("lists only the caller's own rules", async () => {
    const alice = await as('u-alice')<AlertRule[]>('GET', '/api/rules');
    const bob = await as('u-bob')<AlertRule[]>('GET', '/api/rules');
    const carol = await as('u-carol')<AlertRule[]>('GET', '/api/rules');

    expect(alice.body.map((r) => r.id)).toEqual(['r-alice-quakes', 'r-alice-markets']);
    expect(bob.body.map((r) => r.id)).toEqual(['r-bob-news']);
    expect(carol.body).toEqual([]);
  });

  it('returns one own rule by id', async () => {
    const { status, body } = await as('u-alice')<AlertRule>('GET', '/api/rules/r-alice-quakes');

    expect(status).toBe(200);
    expect(body).toMatchObject({ id: 'r-alice-quakes', userId: 'u-alice', category: 'disasters' });
  });
});

describe('POST /api/rules', () => {
  it('creates a rule owned by the caller', async () => {
    const created = await as('u-carol')<AlertRule>('POST', '/api/rules', newRule);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ...newRule, userId: 'u-carol', enabled: true });
    expect(created.body.id).toBeTruthy();
    const list = await as('u-carol')<AlertRule[]>('GET', '/api/rules');
    expect(list.body).toEqual([created.body]);
  });

  it('ignores a userId in the body', async () => {
    const created = await as('u-carol')<AlertRule>('POST', '/api/rules', { ...newRule, userId: 'u-bob' });

    expect(created.body.userId).toBe('u-carol');
  });

  it.each([
    ['no channel', { category: 'news' }, /at least one channel/],
    ['no category', { channelIds: ['email'] }, /category/],
    ['an unknown channel', { category: 'news', channelIds: ['fax'] }, /unknown channel/],
  ])('answers 400 for %s and saves nothing', async (_label, body, message) => {
    const res = await as('u-carol')<{ errors: string[] }>('POST', '/api/rules', body);

    expect(res.status).toBe(400);
    expect(res.body.errors.join(' ')).toMatch(message);
    expect(await container.rules.listByUser('u-carol')).toEqual([]);
  });

  it('accepts a channel that is registered but admin-disabled', async () => {
    await container.channelSettings.setEnabled('slack', false);

    const res = await as('u-carol')('POST', '/api/rules', { ...newRule, channelIds: ['slack'] });

    expect(res.status).toBe(201);
  });
});

describe('PUT /api/rules/:id', () => {
  it('replaces an own rule, keeping its id and owner', async () => {
    const res = await as('u-alice')<AlertRule>('PUT', '/api/rules/r-alice-quakes', {
      ...newRule,
      id: 'hijack',
      userId: 'u-bob',
      enabled: false,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...newRule, id: 'r-alice-quakes', userId: 'u-alice', enabled: false });
    expect(await container.rules.getById('r-alice-quakes')).toEqual(res.body);
    expect(await container.rules.getById('hijack')).toBeUndefined();
  });

  it('answers 400 for an invalid body and leaves the rule unchanged', async () => {
    const before = await container.rules.getById('r-alice-quakes');

    const res = await as('u-alice')('PUT', '/api/rules/r-alice-quakes', { category: 'news', channelIds: [] });

    expect(res.status).toBe(400);
    expect(await container.rules.getById('r-alice-quakes')).toEqual(before);
  });

  it('answers 404 for a missing rule', async () => {
    expect((await as('u-alice')('PUT', '/api/rules/nope', newRule)).status).toBe(404);
  });
});

describe('DELETE /api/rules/:id', () => {
  it('deletes an own rule', async () => {
    const res = await as('u-alice')('DELETE', '/api/rules/r-alice-quakes');

    expect(res.status).toBe(204);
    expect((await as('u-alice')('GET', '/api/rules/r-alice-quakes')).status).toBe(404);
  });
});

describe("other users' rules", () => {
  it.each([
    ['GET', undefined],
    ['PUT', newRule],
    ['DELETE', undefined],
  ] as const)('%s answers 404 and changes nothing', async (method, body) => {
    const before = await container.rules.getById('r-bob-news');

    const res = await as('u-alice')(method, '/api/rules/r-bob-news', body);

    expect(res).toEqual({ status: 404, body: { error: 'rule not found: r-bob-news' } });
    expect(await container.rules.getById('r-bob-news')).toEqual(before);
  });

  it('are not visible to an admin through the user routes either', async () => {
    expect((await as('u-admin')('GET', '/api/rules/r-bob-news')).status).toBe(404);
  });
});

describe('rules drive delivery', () => {
  const emit = (event: Record<string, unknown>) => as()('POST', '/api/dev/events', event);

  it('a rule disabled through the API stops firing (AC5)', async () => {
    const rule = (await container.rules.getById('r-alice-quakes'))!;
    await as('u-alice')('PUT', '/api/rules/r-alice-quakes', { ...rule, enabled: false });

    await emit({ category: 'disasters', title: 'Quake', severity: 5 });

    expect(await container.notifications.listByUser('u-alice')).toEqual([]);
  });

  it('a markets rule ignores moves below its threshold (AC3)', async () => {
    await emit({ category: 'markets', title: 'ACME dips', severity: 3, symbol: 'ACME', percentChange: -2 });
    expect(await container.notifications.listByUser('u-alice')).toEqual([]);

    await emit({ category: 'markets', title: 'ACME drops', severity: 3, symbol: 'ACME', percentChange: -5 });
    expect(await container.notifications.listByUser('u-alice')).toHaveLength(1);
  });

  it('a newly created rule fires with one notification per channel', async () => {
    await as('u-carol')('PUT', '/api/me/contacts', { email: 'carol@example.com', slack: '@carol' });
    await as('u-carol')('POST', '/api/rules', { ...newRule, channelIds: ['email', 'slack'] });

    await emit({ category: 'disasters', title: 'River flood', severity: 3, tags: ['flood'] });

    const carol = await container.notifications.listByUser('u-carol');
    expect(carol.map((n) => [n.channelId, n.status]).sort()).toEqual([
      ['email', 'sent'],
      ['slack', 'sent'],
    ]);
  });
});
