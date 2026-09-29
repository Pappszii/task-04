// Shapes of the server's JSON API (see the API table in the root README).

export type Category = 'news' | 'markets' | 'disasters';

export const CATEGORIES: readonly Category[] = ['news', 'markets', 'disasters'];

export type Severity = 1 | 2 | 3 | 4 | 5;

export type Role = 'user' | 'admin';

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
}

/** Channel id to destination, e.g. `{ email: 'a@b.co' }`. */
export type Contacts = Record<string, string>;

/** Channel id to its new destination; `null` clears it. Channels left out are unchanged. */
export type ContactUpdates = Record<string, string | null>;

export interface Me extends DemoUser {
  contacts: Contacts;
}

/** An enabled channel, as offered to users. */
export interface Channel {
  id: string;
  displayName: string;
  /** What the user has to provide, e.g. "email address". */
  destinationKind: string;
}

export interface AdminChannel extends Channel {
  enabled: boolean;
}

/** Pushed over SSE as `channel-changed`. */
export interface ChannelState {
  channelId: string;
  enabled: boolean;
}

export interface AlertRule {
  id: string;
  userId: string;
  name: string;
  category: Category;
  keywords: string[];
  minSeverity: Severity;
  symbol?: string;
  minPercentMove?: number;
  channelIds: string[];
  enabled: boolean;
}

/** What the client sends to create or replace a rule. `null` clears a markets field. */
export interface AlertRuleInput {
  name?: string;
  category: Category;
  keywords: string[];
  minSeverity: Severity;
  symbol?: string | null;
  minPercentMove?: number | null;
  channelIds: string[];
  enabled: boolean;
}

export type NotificationStatus = 'sent' | 'failed' | 'skipped';

export interface EventSummary {
  title: string;
  category: Category;
  severity: Severity;
  occurredAt: string;
}

/** Named to avoid clashing with the DOM's `Notification`. */
export interface AlertNotification {
  id: string;
  userId: string;
  ruleId: string;
  ruleName: string;
  eventId: string;
  event: EventSummary;
  channelId: string;
  status: NotificationStatus;
  reason?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}
