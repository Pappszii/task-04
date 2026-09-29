import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { createContainer } from './container.js';
import type { WorldEvent } from './domain/index.js';
import type { EventSource } from './ports/index.js';
import { makeEvent } from './testing/fixtures.js';

describe('createContainer', () => {
  it('runs a published world event through the seeded rules end to end, offline', async () => {
    const container = createContainer();
    const published = vi.fn();
    container.notificationBus.subscribe(published);
    const quiet = vi.spyOn(console, 'info').mockImplementation(() => {});

    await container.worldEvents.publish(
      makeEvent({ category: 'disasters', severity: 5, title: 'Major quake', tags: ['earthquake'] }),
    );
    quiet.mockRestore();

    const alice = await container.notifications.listByUser('u-alice');
    expect(alice.map((n) => [n.channelId, n.status]).sort()).toEqual([
      ['email', 'sent'],
      ['slack', 'sent'],
    ]);
    expect(published).toHaveBeenCalledTimes(2);
    expect(await container.notifications.listByUser('u-bob')).toEqual([]);
  });

  it('delivers events emitted by an injected event source, and starts none by itself', async () => {
    const listeners: ((event: WorldEvent) => void)[] = [];
    const source: EventSource = {
      start: vi.fn(),
      stop: vi.fn(),
      onEvent: (cb) => {
        listeners.push(cb);
        return () => {};
      },
    };
    const container = createContainer({ eventSources: [source] });
    const quiet = vi.spyOn(console, 'info').mockImplementation(() => {});

    expect(source.start).not.toHaveBeenCalled();
    listeners[0]!(makeEvent({ severity: 5 }));
    await vi.waitFor(async () => {
      expect(await container.notifications.listByUser('u-alice')).toHaveLength(2);
    });
    quiet.mockRestore();
  });

  it('delivers through every registered channel without any network call (AC7)', async () => {
    const container = createContainer({ eventSources: [] });
    const channelIds = container.registry.list().map((c) => c.id);
    // Valid destinations for the bundled mocks. A channel without one is recorded as skipped, which is fine here:
    // the point is that nothing, sent or skipped, touches the network.
    const samples: Record<string, string> = {
      email: 'alice@example.com',
      slack: '@alice',
      webhook: 'https://hooks.example.com/alice',
    };
    await container.users.setContacts('u-alice', samples);
    await container.rules.create({
      userId: 'u-alice',
      name: 'Everything',
      category: 'news',
      keywords: [],
      minSeverity: 1,
      channelIds,
      enabled: true,
    });
    const offline = () => {
      throw new Error('network call attempted');
    };
    const network = [
      vi.spyOn(globalThis, 'fetch').mockImplementation(offline),
      vi.spyOn(http, 'request').mockImplementation(offline),
      vi.spyOn(https, 'request').mockImplementation(offline),
      vi.spyOn(net, 'connect').mockImplementation(offline),
      vi.spyOn(net, 'createConnection').mockImplementation(offline),
    ];
    const quiet = vi.spyOn(console, 'info').mockImplementation(() => {});

    await container.worldEvents.publish(makeEvent({ category: 'news', severity: 1, title: 'Anything' }));

    const delivered = (await container.notifications.listByUser('u-alice')).filter((n) => n.ruleName === 'Everything');
    expect(delivered.map((n) => n.channelId).sort()).toEqual([...channelIds].sort());
    for (const notification of delivered) {
      expect(notification.status).toBe(notification.channelId in samples ? 'sent' : 'skipped');
    }
    expect(delivered.filter((n) => n.status === 'sent').length).toBeGreaterThanOrEqual(3);
    for (const spy of network) expect(spy).not.toHaveBeenCalled();
    for (const spy of [...network, quiet]) spy.mockRestore();
  });

  it('records a skipped notification for a user without a destination', async () => {
    const container = createContainer();
    await container.users.setContacts('u-alice', { email: 'alice@example.com' });
    const quiet = vi.spyOn(console, 'info').mockImplementation(() => {});

    await container.worldEvents.publish(makeEvent({ severity: 5 }));
    quiet.mockRestore();

    const alice = await container.notifications.listByUser('u-alice');
    expect(alice.find((n) => n.channelId === 'slack')).toMatchObject({ status: 'skipped' });
  });
});
