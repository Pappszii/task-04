import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMAIL, FakeEventSource } from '../testing/fakes';
import { actAs, type Fakes, setupFakes } from '../testing/setup';
import { AvailableChannels } from './available-channels';
import type { Channel } from './models';

describe('AvailableChannels', () => {
  let fakes: Fakes;

  beforeEach(() => {
    fakes = setupFakes();
  });

  const stable = () => TestBed.inject(ApplicationRef).whenStable();

  const start = async () => {
    await actAs('u-alice');
    const channels = TestBed.inject(AvailableChannels);
    await stable();
    return channels;
  };

  it('loads the enabled channels once', async () => {
    const channels = await start();

    expect(channels.list().map((c) => c.id)).toEqual(['email', 'slack']);
    expect(fakes.channels.listCalls).toBe(1);
  });

  it('reloads on channel-changed, keeping the current list until the new one arrives', async () => {
    const channels = await start();
    const next = new Subject<Channel[]>();
    fakes.channels.pendingList = next;

    FakeEventSource.latest().emit('channel-changed', { channelId: 'slack', enabled: false });
    TestBed.tick();

    expect(fakes.channels.listCalls).toBe(2);
    expect(channels.list().map((c) => c.id)).toEqual(['email', 'slack']);

    next.next([EMAIL]);
    next.complete();
    await stable();

    expect(channels.list().map((c) => c.id)).toEqual(['email']);
  });
});
