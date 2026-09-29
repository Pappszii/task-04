import type { AlertRule, ChannelState, Notification, User, WorldEvent } from '../domain/index.js';

/** Produces world events. A real feed and a fixture-driven mock both implement this. */
export interface EventSource {
  start(): void;
  stop(): void;
  /** Returns an unsubscribe function. */
  onEvent(callback: (event: WorldEvent) => void): () => void;
}

export interface ChannelMessage {
  destination: string;
  subject: string;
  body: string;
  event: WorldEvent;
}

export type DeliveryResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string; payload?: Record<string, unknown> };

export type DestinationValidation = { valid: true } | { valid: false; reason: string };

/** A delivery channel. Adding one means implementing this and adding a `register()` call. */
export interface NotificationChannel {
  readonly id: string;
  readonly displayName: string;
  /** What the user has to provide for this channel, e.g. "email address". Rendered by the UI. */
  readonly destinationKind: string;
  validateDestination(destination: string): DestinationValidation;
  /** May resolve `{ ok: false }` or throw; the dispatcher records both as `failed`. */
  send(message: ChannelMessage): Promise<DeliveryResult>;
}

export interface UserRepository {
  getById(id: string): Promise<User | undefined>;
  list(): Promise<User[]>;
  setContacts(id: string, contacts: Record<string, string>): Promise<User | undefined>;
}

export interface AlertRuleRepository {
  getById(id: string): Promise<AlertRule | undefined>;
  listByUser(userId: string): Promise<AlertRule[]>;
  listEnabled(): Promise<AlertRule[]>;
  create(rule: Omit<AlertRule, 'id'>): Promise<AlertRule>;
  update(rule: AlertRule): Promise<AlertRule | undefined>;
  delete(id: string): Promise<boolean>;
}

export interface NotificationRepository {
  add(notification: Notification): Promise<void>;
  listByUser(userId: string): Promise<Notification[]>;
}

export interface ChannelSettingsRepository {
  /** Channels with no stored state are enabled. */
  isEnabled(channelId: string): Promise<boolean>;
  setEnabled(channelId: string, enabled: boolean): Promise<ChannelState>;
  list(): Promise<ChannelState[]>;
}
