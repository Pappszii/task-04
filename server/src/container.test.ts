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
