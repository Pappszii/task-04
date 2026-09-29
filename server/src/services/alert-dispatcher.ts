import { randomUUID } from 'node:crypto';
import type { AlertRule, Notification, User, WorldEvent } from '../domain/index.js';
import type {
  AlertRuleRepository,
  ChannelSettingsRepository,
  NotificationChannel,
  NotificationRepository,
  UserRepository,
} from '../ports/index.js';
import type { ChannelRegistry } from './channel-registry.js';
import { matchesRule } from './rule-matcher.js';

export interface AlertDispatcherDeps {
  rules: AlertRuleRepository;
  users: UserRepository;
  notifications: NotificationRepository;
  channelSettings: ChannelSettingsRepository;
  registry: ChannelRegistry;
  /** Called after each notification is stored (the SSE layer hooks in here). */
  onNotification?: (notification: Notification) => void | Promise<void>;
  now?: () => Date;
  newId?: () => string;
}

/**
 * Turns a world event into one notification per (matching rule, channel).
 * Knows channels only through `ChannelRegistry`; a failing channel never blocks the others.
 */
export class AlertDispatcher {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly deps: AlertDispatcherDeps) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? randomUUID;
  }

  async dispatch(event: WorldEvent): Promise<Notification[]> {
    const rules = (await this.deps.rules.listEnabled()).filter((rule) => matchesRule(event, rule));
    const groups = await Promise.all(rules.map((rule) => this.dispatchRule(event, rule)));
    return groups.flat();
  }

  private async dispatchRule(event: WorldEvent, rule: AlertRule): Promise<Notification[]> {
    const user = await this.deps.users.getById(rule.userId);
    const channelIds = [...new Set(rule.channelIds)];
    return Promise.all(channelIds.map((channelId) => this.deliver(event, rule, user, channelId)));
  }

  private async deliver(
    event: WorldEvent,
    rule: AlertRule,
    user: User | undefined,
    channelId: string,
  ): Promise<Notification> {
    const base = {
      id: this.newId(),
      userId: rule.userId,
      ruleId: rule.id,
      ruleName: rule.name,
      eventId: event.id,
      event: {
        title: event.title,
        category: event.category,
        severity: event.severity,
        occurredAt: event.occurredAt,
      },
      channelId,
      createdAt: this.now().toISOString(),
    };
    const outcome = await this.attempt(event, rule, user, channelId);
    const notification: Notification = { ...base, ...outcome };
    await this.deps.notifications.add(notification);
    await this.deps.onNotification?.(notification);
    return notification;
  }

  private async attempt(
    event: WorldEvent,
    rule: AlertRule,
    user: User | undefined,
    channelId: string,
  ): Promise<Pick<Notification, 'status' | 'reason' | 'payload'>> {
    const channel = this.deps.registry.get(channelId);
    if (!channel) return skipped(`channel "${channelId}" is not registered`);
    if (!(await this.deps.channelSettings.isEnabled(channelId))) return skipped('channel disabled');

    const destination = user?.contacts[channelId]?.trim();
    if (!destination) return skipped(`no destination configured for ${channel.displayName}`);
    const validation = channel.validateDestination(destination);
    if (!validation.valid) return skipped(`invalid destination: ${validation.reason}`);

    return this.send(channel, destination, event, rule);
  }

  private async send(
    channel: NotificationChannel,
    destination: string,
    event: WorldEvent,
    rule: AlertRule,
  ): Promise<Pick<Notification, 'status' | 'reason' | 'payload'>> {
    try {
      const result = await channel.send({
        destination,
        subject: `[${event.category}] ${event.title}`,
        body: `${event.summary}\n\nAlert: ${rule.name}`,
        event,
      });
      if (result.ok) return { status: 'sent', payload: result.payload };
      return { status: 'failed', reason: result.error, payload: result.payload };
    } catch (error) {
      return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
    }
  }
}

function skipped(reason: string): Pick<Notification, 'status' | 'reason'> {
  return { status: 'skipped', reason };
}
