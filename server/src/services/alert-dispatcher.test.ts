import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InMemoryAlertRuleRepository,
  InMemoryChannelSettingsRepository,
  InMemoryNotificationRepository,
  InMemoryUserRepository,
} from '../adapters/in-memory-repositories.js';
import type { AlertRule, Notification, User } from '../domain/index.js';
import { makeEvent, makeRule, makeUser, StubChannel } from '../testing/fixtures.js';
import { AlertDispatcher } from './alert-dispatcher.js';
import { ChannelRegistry } from './channel-registry.js';

interface Setup {
  dispatcher: AlertDispatcher;
  registry: ChannelRegistry;
  notifications: InMemoryNotificationRepository;
  channelSettings: InMemoryChannelSettingsRepository;
  onNotification: ReturnType<typeof vi.fn<(n: Notification) => void>>;
}

function setup(rules: AlertRule[], users: User[] = [makeUser()], channels = [new StubChannel('stub')]): Setup {
  const registry = new ChannelRegistry();
  for (const channel of channels) registry.register(channel);
  const notifications = new InMemoryNotificationRepository();
  const channelSettings = new InMemoryChannelSettingsRepository();
  const onNotification = vi.fn<(n: Notification) => void>();
  let id = 0;
  const dispatcher = new AlertDispatcher({
    rules: new InMemoryAlertRuleRepository(rules),
    users: new InMemoryUserRepository(users),
    notifications,
    channelSettings,
    registry,
    onNotification,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    newId: () => `n-${++id}`,
  });
  return { dispatcher, registry, notifications, channelSettings, onNotification };
}

describe('AlertDispatcher', () => {
  let ok: StubChannel;

  beforeEach(() => {
    ok = new StubChannel('stub');
  });

  it('creates a sent notification for a matching rule and delivers through the channel', async () => {
    const { dispatcher, notifications, onNotification } = setup([makeRule()], [makeUser()], [ok]);

    const result = await dispatcher.dispatch(makeEvent());

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'n-1',
      userId: 'u-1',
      ruleId: 'r-1',
      eventId: 'e-1',
      channelId: 'stub',
      channelName: 'Stub stub',
      ruleName: 'Test rule',
      event: { title: 'Earthquake near coast', category: 'disasters', severity: 4 },
      status: 'sent',
      payload: { to: 'dest-1' },
    });
    expect(ok.sent).toHaveLength(1);
    expect(ok.sent[0]?.destination).toBe('dest-1');
    expect(await notifications.listByUser('u-1')).toEqual(result);
    expect(onNotification).toHaveBeenCalledWith(result[0]);
  });

  it('creates nothing for a non-matching event', async () => {
    const { dispatcher, notifications } = setup([makeRule({ minSeverity: 5 })], [makeUser()], [ok]);

    expect(await dispatcher.dispatch(makeEvent({ severity: 2 }))).toEqual([]);
    expect(await notifications.listByUser('u-1')).toEqual([]);
    expect(ok.sent).toEqual([]);
  });

  it('never fires a disabled rule', async () => {
    const { dispatcher } = setup([makeRule({ enabled: false })], [makeUser()], [ok]);

    expect(await dispatcher.dispatch(makeEvent())).toEqual([]);
    expect(ok.sent).toEqual([]);
  });

  it('creates one notification per selected channel', async () => {
    const other = new StubChannel('other');
    const user = makeUser({ contacts: { stub: 'dest-1', other: 'dest-2' } });
    const { dispatcher } = setup([makeRule({ channelIds: ['stub', 'other'] })], [user], [ok, other]);

    const result = await dispatcher.dispatch(makeEvent());

    expect(result.map((n) => [n.channelId, n.status])).toEqual([
      ['stub', 'sent'],
      ['other', 'sent'],
    ]);
  });

  it('notifies each matching rule separately, one per user', async () => {
    const rules = [makeRule({ id: 'r-1', userId: 'u-1' }), makeRule({ id: 'r-2', userId: 'u-2' })];
    const users = [makeUser({ id: 'u-1' }), makeUser({ id: 'u-2', contacts: { stub: 'dest-2' } })];
    const { dispatcher } = setup(rules, users, [ok]);

    const result = await dispatcher.dispatch(makeEvent());

    expect(result.map((n) => [n.userId, n.ruleId])).toEqual([
      ['u-1', 'r-1'],
      ['u-2', 'r-2'],
    ]);
  });

  it('does not notify twice when a rule lists the same channel twice', async () => {
    const { dispatcher } = setup([makeRule({ channelIds: ['stub', 'stub'] })], [makeUser()], [ok]);

    expect(await dispatcher.dispatch(makeEvent())).toHaveLength(1);
    expect(ok.sent).toHaveLength(1);
  });

  describe('failure isolation', () => {
    it('records a throwing channel as failed and still delivers through the others', async () => {
      const broken = new StubChannel('broken', 'throw');
      const user = makeUser({ contacts: { broken: 'dest-1', stub: 'dest-2' } });
      const { dispatcher } = setup([makeRule({ channelIds: ['broken', 'stub'] })], [user], [broken, ok]);

      const result = await dispatcher.dispatch(makeEvent());

      expect(result.map((n) => [n.channelId, n.status])).toEqual([
        ['broken', 'failed'],
        ['stub', 'sent'],
      ]);
      expect(result[0]?.reason).toBe('boom');
      expect(ok.sent).toHaveLength(1);
    });

    it('records an ok:false result as failed with the provider error', async () => {
      const rejecting = new StubChannel('stub', 'fail');
      const { dispatcher } = setup([makeRule()], [makeUser()], [rejecting]);

      const [notification] = await dispatcher.dispatch(makeEvent());

      expect(notification).toMatchObject({ status: 'failed', reason: 'rejected by provider' });
    });
  });

  describe('skipped deliveries', () => {
    it('skips with a reason when the user has no destination for the channel', async () => {
      const { dispatcher } = setup([makeRule()], [makeUser({ contacts: {} })], [ok]);

      const [notification] = await dispatcher.dispatch(makeEvent());

      expect(notification).toMatchObject({ status: 'skipped' });
      expect(notification?.reason).toMatch(/no destination/);
      expect(ok.sent).toEqual([]);
    });

    it('skips with a reason when the destination is invalid', async () => {
      const { dispatcher } = setup([makeRule()], [makeUser({ contacts: { stub: 'bad-value' } })], [ok]);

      const [notification] = await dispatcher.dispatch(makeEvent());

      expect(notification).toMatchObject({ status: 'skipped' });
      expect(notification?.reason).toMatch(/invalid destination/);
      expect(ok.sent).toEqual([]);
    });

    it('skips when the rule references a channel that is not registered', async () => {
      const { dispatcher } = setup([makeRule({ channelIds: ['gone'] })], [makeUser()], [ok]);

      const [notification] = await dispatcher.dispatch(makeEvent());

      expect(notification).toMatchObject({ status: 'skipped', channelName: 'gone' });
      expect(notification?.reason).toMatch(/not registered/);
    });

    it('skips when the rule belongs to an unknown user', async () => {
      const { dispatcher } = setup([makeRule({ userId: 'ghost' })], [makeUser()], [ok]);

      const [notification] = await dispatcher.dispatch(makeEvent());

      expect(notification).toMatchObject({ status: 'skipped', userId: 'ghost' });
    });
  });

  describe('admin-disabled channels', () => {
    it('skips while disabled and delivers again once re-enabled', async () => {
      const { dispatcher, channelSettings } = setup([makeRule()], [makeUser()], [ok]);

      await channelSettings.setEnabled('stub', false);
      const [skipped] = await dispatcher.dispatch(makeEvent({ id: 'e-1' }));
      expect(skipped).toMatchObject({ status: 'skipped', reason: 'channel disabled' });
      expect(ok.sent).toEqual([]);

      await channelSettings.setEnabled('stub', true);
      const [sent] = await dispatcher.dispatch(makeEvent({ id: 'e-2' }));
      expect(sent).toMatchObject({ status: 'sent' });
      expect(ok.sent).toHaveLength(1);
    });
  });

  describe('extensibility', () => {
    it('delivers through a newly registered third channel with no dispatcher changes', async () => {
      const webhook = new StubChannel('webhook');
      const user = makeUser({ contacts: { stub: 'dest-1', webhook: 'https://hooks.test/x' } });
      const { dispatcher } = setup([makeRule({ channelIds: ['stub', 'webhook'] })], [user], [ok, webhook]);

      const result = await dispatcher.dispatch(makeEvent());

      expect(result.map((n) => [n.channelId, n.status])).toEqual([
        ['stub', 'sent'],
        ['webhook', 'sent'],
      ]);
      expect(webhook.sent).toHaveLength(1);
    });
  });

  it('records a failed notification when validateDestination throws, and still delivers the others', async () => {
    const broken = new StubChannel('broken');
    broken.validateDestination = () => {
      throw new Error('validator exploded');
    };
    const rule = makeRule({ channelIds: ['broken', 'stub'] });
    const user = makeUser({ contacts: { broken: 'x', stub: 'dest-1' } });
    const { dispatcher } = setup([rule], [user], [broken, ok]);

    const result = await dispatcher.dispatch(makeEvent());

    expect(result.find((n) => n.channelId === 'broken')).toMatchObject({
      status: 'failed',
      reason: 'validator exploded',
    });
    expect(result.find((n) => n.channelId === 'stub')?.status).toBe('sent');
  });

  it('still returns every notification when the onNotification hook throws', async () => {
    const rule = makeRule({ channelIds: ['stub', 'other'] });
    const user = makeUser({ contacts: { stub: 'dest-1', other: 'dest-2' } });
    const { dispatcher, onNotification } = setup([rule], [user], [ok, new StubChannel('other')]);
    onNotification.mockRejectedValueOnce(new Error('bus down') as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await dispatcher.dispatch(makeEvent());

    expect(result).toHaveLength(2);
    expect(result.every((n) => n.status === 'sent')).toBe(true);
  });
});
