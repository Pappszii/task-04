import { randomUUID } from 'node:crypto';
import type { AlertRule, ChannelState, Notification, User } from '../domain/index.js';
import type {
  AlertRuleRepository,
  ChannelSettingsRepository,
  NotificationRepository,
  UserRepository,
} from '../ports/index.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  constructor(initial: User[] = []) {
    for (const user of initial) this.users.set(user.id, structuredClone(user));
  }

  async getById(id: string): Promise<User | undefined> {
    return clone(this.users.get(id));
  }

  async list(): Promise<User[]> {
    return [...this.users.values()].map((u) => structuredClone(u));
  }

  async setContacts(id: string, contacts: Record<string, string>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    user.contacts = { ...contacts };
    return structuredClone(user);
  }
}

export class InMemoryAlertRuleRepository implements AlertRuleRepository {
  private readonly rules = new Map<string, AlertRule>();

  constructor(initial: AlertRule[] = []) {
    for (const rule of initial) this.rules.set(rule.id, structuredClone(rule));
  }

  async getById(id: string): Promise<AlertRule | undefined> {
    return clone(this.rules.get(id));
  }

  async listByUser(userId: string): Promise<AlertRule[]> {
    return [...this.rules.values()].filter((r) => r.userId === userId).map((r) => structuredClone(r));
  }

  async listEnabled(): Promise<AlertRule[]> {
    return [...this.rules.values()].filter((r) => r.enabled).map((r) => structuredClone(r));
  }

  async create(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const created: AlertRule = { ...structuredClone(rule), id: randomUUID() };
    this.rules.set(created.id, created);
    return structuredClone(created);
  }

  async update(rule: AlertRule): Promise<AlertRule | undefined> {
    if (!this.rules.has(rule.id)) return undefined;
    this.rules.set(rule.id, structuredClone(rule));
    return structuredClone(rule);
  }

  async delete(id: string): Promise<boolean> {
    return this.rules.delete(id);
  }
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly notifications: Notification[] = [];

  async add(notification: Notification): Promise<void> {
    this.notifications.push(structuredClone(notification));
  }

  /** Newest first. */
  async listByUser(userId: string): Promise<Notification[]> {
    return this.notifications
      .filter((n) => n.userId === userId)
      .map((n) => structuredClone(n))
      .reverse();
  }
}

export class InMemoryChannelSettingsRepository implements ChannelSettingsRepository {
  private readonly states = new Map<string, ChannelState>();

  async isEnabled(channelId: string): Promise<boolean> {
    return this.states.get(channelId)?.enabled ?? true;
  }

  async setEnabled(channelId: string, enabled: boolean): Promise<ChannelState> {
    const state = { channelId, enabled };
    this.states.set(channelId, state);
    return { ...state };
  }

  async list(): Promise<ChannelState[]> {
    return [...this.states.values()].map((s) => ({ ...s }));
  }
}

function clone<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : structuredClone(value);
}
