import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionService } from '../../core/session.service';
import { FakeEventSource, httpError, makeNotification } from '../../testing/fakes';
import { actAs, type Fakes, query, setupFakes, textOf } from '../../testing/setup';
import { NotificationsPage } from './notifications-page';

describe('NotificationsPage', () => {
  let fakes: Fakes;

  beforeEach(() => {
    fakes = setupFakes();
    fakes.notifications.notifications = [
      makeNotification({ id: 'n-2', event: { ...makeNotification().event, title: 'Wildfire' }, channelId: 'slack', channelName: 'Slack', status: 'skipped', reason: 'channel disabled' }),
      makeNotification({ id: 'n-1', event: { ...makeNotification().event, title: 'Quake' } }),
    ];
  });

  const render = async () => {
    await actAs('u-alice');
    const fixture = TestBed.createComponent(NotificationsPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const titles = () => textOf(el, 'ol > li p.font-medium span.break-words');
    return { fixture, el, titles, stable: () => fixture.whenStable() };
  };

  it('lists the history, newest first, with status as text and the reason for a skip', async () => {
    const { el, titles } = await render();

    expect(titles()).toEqual(['Wildfire', 'Quake']);
    expect(textOf(el, 'ol > li app-status-tag')).toEqual(['Skipped', 'Sent']);
    expect(el.textContent).toContain('Skipped: channel disabled');
    expect(el.textContent).toContain('via Slack');
  });

  describe('live updates (AC11)', () => {
    it('adds a pushed notification to the top without reloading, marked as new', async () => {
      const { el, titles, stable } = await render();

      FakeEventSource.latest().emit(
        'notification',
        makeNotification({ id: 'n-3', event: { ...makeNotification().event, title: 'Tsunami warning' } }),
      );
      await stable();

      expect(titles()).toEqual(['Tsunami warning', 'Wildfire', 'Quake']);
      expect(query(el, 'ol > li:first-child').textContent).toContain('New');
      expect(fakes.notifications.listCalls).toBe(1);
      expect(query(el, 'p.sr-only[role="status"]').textContent).toContain(
        'New notification: Tsunami warning, Email, Sent.',
      );
    });

    it('does not show a pushed notification twice when the history already has it', async () => {
      const { titles, stable } = await render();

      FakeEventSource.latest().emit('notification', fakes.notifications.notifications[0]);
      await stable();

      expect(titles()).toEqual(['Wildfire', 'Quake']);
    });

    it('turns the empty state into a list when the first notification arrives', async () => {
      fakes.notifications.notifications = [];
      const { el, titles, stable } = await render();
      expect(el.textContent).toContain('No notifications yet');

      FakeEventSource.latest().emit('notification', makeNotification({ id: 'n-9' }));
      await stable();

      expect(titles()).toEqual(['Quake']);
    });
  });

  it('shows the error and retries', async () => {
    fakes.notifications.listError = httpError(0, null);
    const { el, titles, stable } = await render();

    expect(query(el, '[role="alert"]').textContent).toContain('Cannot reach the server');

    fakes.notifications.listError = null;
    query<HTMLButtonElement>(el, '[role="alert"] button').click();
    await stable();

    expect(titles()).toEqual(['Wildfire', 'Quake']);
  });

  it("reloads for a new demo user and drops the previous user's live items", async () => {
    const { titles, stable } = await render();
    FakeEventSource.latest().emit('notification', makeNotification({ id: 'n-live' }));
    await stable();

    fakes.notifications.notifications = [
      makeNotification({ id: 'n-bob', userId: 'u-bob', event: { ...makeNotification().event, title: 'Election' } }),
    ];
    TestBed.inject(SessionService).select('u-bob');
    await stable();

    expect(titles()).toEqual(['Election']);
    expect(fakes.notifications.listCalls).toBe(2);
  });
});
