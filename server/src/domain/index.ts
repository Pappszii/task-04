export type Category = 'news' | 'markets' | 'disasters';

export type Severity = 1 | 2 | 3 | 4 | 5;

export interface WorldEvent {
  id: string;
  category: Category;
  title: string;
  summary: string;
  severity: Severity;
  tags: string[];
  /** Markets only. */
  symbol?: string;
  /** Markets only. Signed percentage move, e.g. -3.2. */
  percentChange?: number;
  occurredAt: string;
  source: string;
}

export interface AlertRule {
  id: string;
  userId: string;
  name: string;
  category: Category;
  /** Case-insensitive substring match against title, summary and tags. Empty means no keyword filter. */
  keywords: string[];
  minSeverity: Severity;
  /** Markets only. */
  symbol?: string;
  /** Markets only. Compared against the absolute value of `percentChange`. */
  minPercentMove?: number;
  channelIds: string[];
  enabled: boolean;
}

export type Role = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  role: Role;
  /** Destination per channel id, e.g. an email address or a Slack handle. */
  contacts: Record<string, string>;
}

export type NotificationStatus = 'sent' | 'failed' | 'skipped';

export interface Notification {
  id: string;
  userId: string;
  ruleId: string;
  eventId: string;
  channelId: string;
  status: NotificationStatus;
  /** Set for `failed` and `skipped`. */
  reason?: string;
  /** What the channel built (and, for mocks, would have sent). Set when a send was attempted. */
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface ChannelState {
  channelId: string;
  enabled: boolean;
}
