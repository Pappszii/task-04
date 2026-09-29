import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, type Container } from '../../container.js';
import { apiClient, openStream, startServer, type SseStream, type TestServer } from '../../testing/http.js';

let container: Container;
let server: TestServer;
const streams: SseStream[] = [];

const connect = async (query: string, headers: Record<string, string> = {}) => {
  const stream = await openStream(`${server.base}/api/stream${query}`, headers);
  streams.push(stream);
  return stream;
};
const emit = (event: Record<string, unknown>) => apiClient(server.base)('POST', '/api/dev/events', event);

beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  container = createContainer({ eventSources: [] });
  server = await startServer(container);
});

afterEach(async () => {
  for (const stream of streams.splice(0)) stream.close();
  await server.close();
  vi.restoreAllMocks();
});

describe('GET /api/stream', () => {
  it('opens an event stream for ?userId=', async () => {
    const stream = await connect('?userId=u-alice');

    expect(stream.status).toBe(200);
    expect(stream.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(stream.headers.get('cache-control')).toMatch(/no-cache/);
  });

  it('also accepts the X-Demo-User header', async () => {
    const stream = await connect('', { 'X-Demo-User': 'u-alice' });

    expect(stream.status).toBe(200);
  });

  it.each([
    ['no user', ''],
    ['an unknown user', '?userId=u-nobody'],
  ])('answers 401 for %s', async (_label, query) => {
    const stream = await connect(query);

    expect(stream.status).toBe(401);
  });

  it('pushes a new notification to its owner (AC11)', async () => {
    const alice = await connect('?userId=u-alice');

    await emit({ category: 'disasters', title: 'Live quake', severity: 5 });

    const frames = [await alice.next(), await alice.next()];
    expect(frames.map((f) => f.event)).toEqual(['notification', 'notification']);
    expect(frames.map((f) => f.data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'u-alice', channelId: 'email', event: expect.objectContaining({ title: 'Live quake' }) }),
        expect.objectContaining({ userId: 'u-alice', channelId: 'slack' }),
      ]),
    );
  });

  it("never pushes another user's notification", async () => {
    const bob = await connect('?userId=u-bob');

    // Matches only Alice's rule, then one that matches only Bob's.
    await emit({ category: 'disasters', title: 'Quake for Alice', severity: 5 });
    await emit({ category: 'news', title: 'Election for Bob', severity: 4, tags: ['election'] });

    const first = await bob.next();
    expect(first.event).toBe('notification');
    expect(first.data).toMatchObject({ userId: 'u-bob', event: { title: 'Election for Bob' } });
  });

  it('broadcasts channel-changed to every connected user', async () => {
    const alice = await connect('?userId=u-alice');
    const bob = await connect('?userId=u-bob');

    await apiClient(server.base, 'u-admin')('PATCH', '/api/admin/channels/slack', { enabled: false });

    const expected = { event: 'channel-changed', data: { channelId: 'slack', enabled: false } };
    expect(await alice.next()).toEqual(expected);
    expect(await bob.next()).toEqual(expected);
  });

  it('unsubscribes when the client disconnects', async () => {
    expect(container.notificationBus.subscriberCount).toBe(0);
    const alice = await connect('?userId=u-alice');
    expect(container.notificationBus.subscriberCount).toBe(1);
    expect(container.channelEvents.subscriberCount).toBe(1);

    alice.close();

    await vi.waitFor(() => {
      expect(container.notificationBus.subscriberCount).toBe(0);
      expect(container.channelEvents.subscriberCount).toBe(0);
    });
    // Publishing after the disconnect must not throw.
    expect((await emit({ category: 'disasters', title: 'After', severity: 5 })).status).toBe(201);
  });
});
