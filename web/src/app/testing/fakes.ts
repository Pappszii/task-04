import { HttpErrorResponse } from '@angular/common/http';
import { type Observable, of, throwError } from 'rxjs';
import { ChannelsApi } from '../core/api/channels-api';
import { NotificationsApi } from '../core/api/notifications-api';
import { RulesApi } from '../core/api/rules-api';
import { UsersApi } from '../core/api/users-api';
import type {
  AdminChannel,
  AlertNotification,
  AlertRule,
  AlertRuleInput,
  Channel,
  ContactUpdates,
  Contacts,
  DemoUser,
  Me,
} from '../core/models';
import type { EventSourceLike } from '../core/realtime.service';

export const DEMO_USERS: DemoUser[] = [
  { id: 'u-alice', name: 'Alice', role: 'user' },
  { id: 'u-bob', name: 'Bob', role: 'user' },
  { id: 'u-admin', name: 'Admin', role: 'admin' },
];

export const EMAIL: Channel = { id: 'email', displayName: 'Email', destinationKind: 'email address' };
export const SLACK: Channel = { id: 'slack', displayName: 'Slack', destinationKind: 'Slack handle' };
export const WEBHOOK: Channel = { id: 'webhook', displayName: 'Webhook', destinationKind: 'webhook URL' };

/** An error shaped like the server's, e.g. `httpError(400, { errors: ['...'] })`. */
export function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

function fail<T>(error: unknown): Observable<T> {
  return throwError(() => error);
}

/** `me()` answers for whoever `currentUserId()` returns, so it follows the session like the real API. */
export class FakeUsersApi extends UsersApi {
  demoUsers$: Observable<DemoUser[]> = of(DEMO_USERS);
  listDemoUsersCalls = 0;
  meError: unknown = null;
  contactsError: unknown = null;
  readonly contactUpdates: ContactUpdates[] = [];
  readonly contactsByUser: Record<string, Contacts> = {
    'u-alice': { email: 'alice@example.com', slack: '@alice' },
    'u-bob': { email: 'bob@example.com' },
    'u-admin': {},
  };

  constructor(private readonly currentUserId: () => string | null = () => 'u-alice') {
    super();
  }

  listDemoUsers(): Observable<DemoUser[]> {
    this.listDemoUsersCalls += 1;
    return this.demoUsers$;
  }

  me(): Observable<Me> {
    if (this.meError) return fail(this.meError);
    const user = DEMO_USERS.find((u) => u.id === this.currentUserId());
    if (!user) return fail(httpError(401, { error: 'unknown demo user' }));
    return of({ ...user, contacts: { ...(this.contactsByUser[user.id] ?? {}) } });
  }

  updateContacts(updates: ContactUpdates): Observable<Contacts> {
    this.contactUpdates.push(updates);
    if (this.contactsError) return fail(this.contactsError);
    const userId = this.currentUserId() ?? '';
    const contacts = { ...(this.contactsByUser[userId] ?? {}) };
    for (const [channelId, destination] of Object.entries(updates)) {
      if (destination === null) delete contacts[channelId];
      else contacts[channelId] = destination;
    }
    this.contactsByUser[userId] = contacts;
    return of({ ...contacts });
  }
}

/** `list()` returns the enabled entries of `channels`; flip `enabled` to simulate an admin toggle. */
export class FakeChannelsApi extends ChannelsApi {
  channels: AdminChannel[] = [
    { ...EMAIL, enabled: true },
    { ...SLACK, enabled: true },
  ];
  listError: unknown = null;
  listAllError: unknown = null;
  setEnabledError: unknown = null;
  /** When set, `list()` answers with this instead of right away, so a test can hold a load open. */
  pendingList: Observable<Channel[]> | null = null;
  listCalls = 0;
  listAllCalls = 0;

  list(): Observable<Channel[]> {
    this.listCalls += 1;
    if (this.listError) return fail(this.listError);
    if (this.pendingList) return this.pendingList;
    return of(this.channels.filter((c) => c.enabled).map(({ enabled: _enabled, ...channel }) => channel));
  }

  listAll(): Observable<AdminChannel[]> {
    this.listAllCalls += 1;
    if (this.listAllError) return fail(this.listAllError);
    return of(this.channels.map((c) => ({ ...c })));
  }

  setEnabled(channelId: string, enabled: boolean): Observable<AdminChannel> {
    if (this.setEnabledError) return fail(this.setEnabledError);
    const channel = this.channels.find((c) => c.id === channelId);
    if (!channel) return fail(httpError(404, { error: `unknown channel: ${channelId}` }));
    channel.enabled = enabled;
    return of({ ...channel });
  }
}

/** Keeps rules in memory and records every write. Set `saveError` / `deleteError` to make writes fail. */
export class FakeRulesApi extends RulesApi {
  rules: AlertRule[] = [];
  listError: unknown = null;
  saveError: unknown = null;
  deleteError: unknown = null;
  listCalls = 0;
  readonly created: AlertRuleInput[] = [];
  readonly updated: { id: string; input: AlertRuleInput }[] = [];
  readonly deleted: string[] = [];
  private nextId = 1;

  list(): Observable<AlertRule[]> {
    this.listCalls += 1;
    if (this.listError) return fail(this.listError);
    return of(structuredClone(this.rules));
  }

  create(input: AlertRuleInput): Observable<AlertRule> {
    this.created.push(input);
    if (this.saveError) return fail(this.saveError);
    const rule = toRule(input, `r-new-${this.nextId++}`, 'u-alice');
    this.rules.push(rule);
    return of(structuredClone(rule));
  }

  update(id: string, input: AlertRuleInput): Observable<AlertRule> {
    this.updated.push({ id, input });
    if (this.saveError) return fail(this.saveError);
    const existing = this.rules.find((r) => r.id === id);
    if (!existing) return fail(httpError(404, { error: `rule not found: ${id}` }));
    const rule = toRule(input, id, existing.userId);
    this.rules = this.rules.map((r) => (r.id === id ? rule : r));
    return of(structuredClone(rule));
  }

  delete(id: string): Observable<void> {
    this.deleted.push(id);
    if (this.deleteError) return fail(this.deleteError);
    this.rules = this.rules.filter((r) => r.id !== id);
    return of(undefined);
  }
}

export class FakeNotificationsApi extends NotificationsApi {
  notifications: AlertNotification[] = [];
  listError: unknown = null;
  listCalls = 0;

  list(): Observable<AlertNotification[]> {
    this.listCalls += 1;
    if (this.listError) return fail(this.listError);
    return of(structuredClone(this.notifications));
  }
}

/** Mirrors the server: blank name gets a default, null markets fields are dropped. */
function toRule(input: AlertRuleInput, id: string, userId: string): AlertRule {
  const rule: AlertRule = {
    id,
    userId,
    name: input.name || 'Untitled alert',
    category: input.category,
    keywords: input.keywords,
    minSeverity: input.minSeverity,
    channelIds: input.channelIds,
    enabled: input.enabled,
  };
  if (input.symbol) rule.symbol = input.symbol;
  if (input.minPercentMove !== null && input.minPercentMove !== undefined) rule.minPercentMove = input.minPercentMove;
  return rule;
}

export function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'r-1',
    userId: 'u-alice',
    name: 'Serious disasters',
    category: 'disasters',
    keywords: [],
    minSeverity: 4,
    channelIds: ['email'],
    enabled: true,
    ...overrides,
  };
}

export function makeNotification(overrides: Partial<AlertNotification> = {}): AlertNotification {
  return {
    id: 'n-1',
    userId: 'u-alice',
    ruleId: 'r-1',
    ruleName: 'Serious disasters',
    eventId: 'e-1',
    event: { title: 'Quake', category: 'disasters', severity: 5, occurredAt: '2026-01-01T10:00:00.000Z' },
    channelId: 'email',
    channelName: 'Email',
    status: 'sent',
    createdAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Records every instance so a test can drive the connection the service opened. */
export class FakeEventSource implements EventSourceLike {
  static instances: FakeEventSource[] = [];

  static reset(): void {
    FakeEventSource.instances = [];
  }

  static latest(): FakeEventSource {
    const latest = FakeEventSource.instances.at(-1);
    if (!latest) throw new Error('no EventSource was opened');
    return latest;
  }

  readyState = 0;
  closed = false;
  private readonly listeners = new Map<string, ((event: MessageEvent) => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  open(): void {
    this.readyState = 1;
    this.dispatch('open', undefined);
  }

  /** `data` is sent as JSON unless it is already a string. */
  emit(type: string, data: unknown): void {
    this.dispatch(type, typeof data === 'string' ? data : JSON.stringify(data));
  }

  fail(readyState: 0 | 2): void {
    this.readyState = readyState;
    this.dispatch('error', undefined);
  }

  private dispatch(type: string, data: string | undefined): void {
    const event = new MessageEvent(type, { data });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

export const fakeEventSourceFactory = (url: string): EventSourceLike => new FakeEventSource(url);
