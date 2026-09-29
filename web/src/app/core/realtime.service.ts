import { effect, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { API_BASE_URL } from './api/api-base-url';
import type { AlertNotification, ChannelState } from './models';
import { SessionService } from './session.service';

/** The part of the browser's `EventSource` this service uses, so tests can pass a fake. */
export interface EventSourceLike {
  readonly readyState: number;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
}

export type EventSourceFactory = (url: string) => EventSourceLike;

export const EVENT_SOURCE_FACTORY = new InjectionToken<EventSourceFactory>('EVENT_SOURCE_FACTORY', {
  providedIn: 'root',
  factory: () => (url) => new EventSource(url),
});

/** `EventSource.CLOSED`, spelled out so this file doesn't need `EventSource` to exist (it doesn't in jsdom). */
const CLOSED = 2;

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/**
 * One SSE connection to `/api/stream` for the current demo user, reopened when the user changes.
 * The browser reconnects on its own after a dropped connection.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly session = inject(SessionService);
  private readonly createEventSource = inject(EVENT_SOURCE_FACTORY);
  private readonly base = inject(API_BASE_URL);

  readonly status = signal<RealtimeStatus>('idle');
  /** Notifications pushed since the current user connected, newest first. Cleared when the user changes. */
  readonly notifications = signal<AlertNotification[]>([]);
  /** The latest admin channel toggle. Watch it to reload channel lists. */
  readonly lastChannelChange = signal<ChannelState | null>(null);

  constructor() {
    effect((onCleanup) => {
      const userId = this.session.currentUserId();
      this.notifications.set([]);
      if (!userId) {
        this.status.set('idle');
        return;
      }
      const source = this.connect(userId);
      onCleanup(() => source.close());
    });
  }

  private connect(userId: string): EventSourceLike {
    this.status.set('connecting');
    const source = this.createEventSource(`${this.base}/api/stream?userId=${encodeURIComponent(userId)}`);

    source.addEventListener('open', () => this.status.set('open'));
    source.addEventListener('error', () => {
      this.status.set(source.readyState === CLOSED ? 'closed' : 'reconnecting');
    });
    source.addEventListener('notification', (event) => {
      const notification = parse<AlertNotification>(event);
      if (notification) this.notifications.update((list) => [notification, ...list]);
    });
    source.addEventListener('channel-changed', (event) => {
      const state = parse<ChannelState>(event);
      if (state) this.lastChannelChange.set(state);
    });
    return source;
  }
}

function parse<T>(event: MessageEvent): T | undefined {
  if (typeof event.data !== 'string') return undefined;
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return undefined;
  }
}
