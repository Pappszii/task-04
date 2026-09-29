import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, type Container } from '../../container.js';
import type { Notification } from '../../domain/index.js';
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

describe('GET /api/me', () => {
  it('returns the demo user', async () => {
    expect(await as('u-bob')('GET', '/api/me')).toEqual({
      status: 200,
      body: { id: 'u-bob', name: 'Bob', role: 'user', contacts: { email: 'bob@example.com' } },
    });
  });

  it('reports the admin role', async () => {
    expect((await as('u-admin')('GET', '/api/me')).body).toMatchObject({ role: 'admin' });
  });
});

describe('/api/me/contacts', () => {
  it('GET returns the contacts', async () => {
    expect((await as('u-alice')('GET', '/api/me/contacts')).body).toEqual({
      email: 'alice@example.com',
      slack: '@alice',
    });
  });

  it('PUT sets a destination and keeps the others', async () => {
    const res = await as('u-bob')('PUT', '/api/me/contacts', { slack: '@bob' });

    expect(res).toEqual({ status: 200, body: { email: 'bob@example.com', slack: '@bob' } });
    expect((await as('u-bob')('GET', '/api/me')).body).toMatchObject({
      contacts: { email: 'bob@example.com', slack: '@bob' },
    });
  });

  it('PUT with an empty string clears a destination', async () => {
    const res = await as('u-alice')('PUT', '/api/me/contacts', { email: '' });

    expect(res.body).toEqual({ slack: '@alice' });
  });

  it('PUT answers 400 for an invalid destination and changes nothing', async () => {
    const res = await as('u-alice')('PUT', '/api/me/contacts', { email: 'nope', slack: '@ok' });

    expect(res).toEqual({ status: 400, body: { errors: ['Email: expected an email address'] } });
    expect((await container.users.getById('u-alice'))?.contacts).toEqual({
      email: 'alice@example.com',
      slack: '@alice',
    });
  });

  it('PUT answers 400 for an unknown channel', async () => {
    const res = await as('u-alice')('PUT', '/api/me/contacts', { fax: '555' });

    expect(res).toEqual({ status: 400, body: { errors: ['unknown channel: fax'] } });
  });

  it("only changes the caller's contacts", async () => {
    await as('u-bob')('PUT', '/api/me/contacts', { email: 'bob2@example.com' });

    expect((await container.users.getById('u-alice'))?.contacts.email).toBe('alice@example.com');
  });

  it('a newly added destination turns a skipped delivery into a sent one (AC9)', async () => {
    const election = { category: 'news', title: 'Election called', severity: 4, tags: ['election'] };

    await as()('POST', '/api/dev/events', election);
    await as('u-bob')('PUT', '/api/me/contacts', { slack: '@bob' });
    await as()('POST', '/api/dev/events', election);

    const slack = (await container.notifications.listByUser('u-bob'))
      .filter((n) => n.channelId === 'slack')
      .map((n) => n.status);
    expect(slack).toEqual(['sent', 'skipped']);
  });
});

describe('GET /api/notifications', () => {
  it("returns the caller's own notifications, newest first, with rule name and event summary", async () => {
    await as()('POST', '/api/dev/events', { category: 'disasters', title: 'First quake', severity: 5 });
    await as()('POST', '/api/dev/events', { category: 'disasters', title: 'Second quake', severity: 4 });

    const { status, body } = await as('u-alice')<Notification[]>('GET', '/api/notifications');

    expect(status).toBe(200);
    expect(body.map((n) => n.event.title)).toEqual(['Second quake', 'Second quake', 'First quake', 'First quake']);
    expect(body[0]).toMatchObject({
      userId: 'u-alice',
      ruleId: 'r-alice-quakes',
      ruleName: 'Serious disasters',
      status: 'sent',
      event: { title: 'Second quake', category: 'disasters', severity: 4 },
    });
  });

  it("never includes other users' notifications", async () => {
    await as()('POST', '/api/dev/events', { category: 'disasters', title: 'Quake', severity: 5 });

    expect((await as('u-bob')('GET', '/api/notifications')).body).toEqual([]);
  });
});
