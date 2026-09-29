import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEMO_USERS,
  FakeEventSource,
  fakeEventSourceFactory,
  FakeUsersApi,
  makeNotification,
} from '../testing/fakes';
import { UsersApi } from './api/users-api';
import type { DemoUser } from './models';
import { EVENT_SOURCE_FACTORY, RealtimeService } from './realtime.service';
import { SessionService } from './session.service';

const notification = (id: string) => makeNotification({ id });

describe('RealtimeService', () => {
  let api: FakeUsersApi;

  beforeEach(() => {
    localStorage.clear();
    FakeEventSource.reset();
    api = new FakeUsersApi();
    TestBed.configureTestingModule({
      providers: [
        { provide: UsersApi, useValue: api },
        { provide: EVENT_SOURCE_FACTORY, useValue: fakeEventSourceFactory },
      ],
    });
  });

  /** Loads the demo users, starts the service and lets its effect connect. */
  const start = async () => {
    const session = TestBed.inject(SessionService);
    await session.load();
    const realtime = TestBed.inject(RealtimeService);
    TestBed.tick();
    return { session, realtime };
  };

  it('stays idle and opens nothing until there is a user', () => {
    api.demoUsers$ = new Subject<DemoUser[]>();
    void TestBed.inject(SessionService).load();
    const realtime = TestBed.inject(RealtimeService);
    TestBed.tick();

    expect(realtime.status()).toBe('idle');
    expect(FakeEventSource.instances).toEqual([]);
  });

  it("connects to the current user's stream and reports when it is open", async () => {
    const { realtime } = await start();

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.latest().url).toBe('/api/stream?userId=u-alice');
    expect(realtime.status()).toBe('connecting');

    FakeEventSource.latest().open();
    expect(realtime.status()).toBe('open');
  });

  it('collects pushed notifications, newest first, and ignores malformed ones', async () => {
    const { realtime } = await start();
    const source = FakeEventSource.latest();

    source.emit('notification', notification('n-1'));
    source.emit('notification', '{not json');
    source.emit('notification', notification('n-2'));

    expect(realtime.notifications().map((n) => n.id)).toEqual(['n-2', 'n-1']);
  });

  it('exposes the latest channel change', async () => {
    const { realtime } = await start();

    FakeEventSource.latest().emit('channel-changed', { channelId: 'slack', enabled: false });

    expect(realtime.lastChannelChange()).toEqual({ channelId: 'slack', enabled: false });
  });

  it('reconnects as the new user on a switch, closing the old stream and clearing notifications', async () => {
    const { session, realtime } = await start();
    const first = FakeEventSource.latest();
    first.emit('notification', notification('n-1'));

    session.select('u-bob');
    TestBed.tick();

    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.latest().url).toBe('/api/stream?userId=u-bob');
    expect(realtime.notifications()).toEqual([]);
  });

  it('encodes the user id in the URL', async () => {
    const users = new Subject<DemoUser[]>();
    api.demoUsers$ = users;
    const session = TestBed.inject(SessionService);
    const loaded = session.load();
    users.next([{ id: 'u a&b', name: 'Odd', role: 'user' }, ...DEMO_USERS]);
    users.complete();
    await loaded;
    TestBed.inject(RealtimeService);
    TestBed.tick();

    expect(FakeEventSource.latest().url).toBe('/api/stream?userId=u%20a%26b');
  });

  it('reports reconnecting while the browser retries, and closed when it gives up', async () => {
    const { realtime } = await start();
    const source = FakeEventSource.latest();
    source.open();

    source.fail(0);
    expect(realtime.status()).toBe('reconnecting');

    source.fail(2);
    expect(realtime.status()).toBe('closed');
  });
});
