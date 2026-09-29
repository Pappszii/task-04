import { type Observable, of, throwError } from 'rxjs';
import { UsersApi } from '../core/api/users-api';
import type { ContactUpdates, Contacts, DemoUser, Me } from '../core/models';
import type { EventSourceLike } from '../core/realtime.service';

export const DEMO_USERS: DemoUser[] = [
  { id: 'u-alice', name: 'Alice', role: 'user' },
  { id: 'u-bob', name: 'Bob', role: 'user' },
  { id: 'u-admin', name: 'Admin', role: 'admin' },
];

/** Returns `demoUsers$` from `listDemoUsers()`; swap it for a Subject or an error to control loading. */
export class FakeUsersApi extends UsersApi {
  demoUsers$: Observable<DemoUser[]> = of(DEMO_USERS);
  listDemoUsersCalls = 0;

  listDemoUsers(): Observable<DemoUser[]> {
    this.listDemoUsersCalls += 1;
    return this.demoUsers$;
  }

  me(): Observable<Me> {
    return throwError(() => new Error('FakeUsersApi.me is not faked'));
  }

  updateContacts(_updates: ContactUpdates): Observable<Contacts> {
    return throwError(() => new Error('FakeUsersApi.updateContacts is not faked'));
  }
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
