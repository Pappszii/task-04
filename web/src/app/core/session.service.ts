import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UsersApi } from './api/users-api';
import type { DemoUser } from './models';

export const DEMO_USER_STORAGE_KEY = 'world-alerts.demo-user';

export type SessionStatus = 'loading' | 'ready' | 'error';

/**
 * Which seeded demo user the app is acting as. There is no real auth:
 * the choice is remembered in localStorage and sent as `X-Demo-User`.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly usersApi = inject(UsersApi);
  private readonly selectedId = signal<string | null>(readStoredId());
  private loading: Promise<void> | undefined;

  readonly status = signal<SessionStatus>('loading');
  readonly users = signal<DemoUser[]>([]);

  /** The selected user, or the first one when nothing (valid) is selected yet. */
  readonly currentUser = computed<DemoUser | undefined>(() => {
    const users = this.users();
    return users.find((u) => u.id === this.selectedId()) ?? users[0];
  });
  readonly currentUserId = computed(() => this.currentUser()?.id ?? null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');

  /** Loads the demo users once. Safe to call repeatedly; retries after a failure. */
  load(): Promise<void> {
    this.loading ??= firstValueFrom(this.usersApi.listDemoUsers()).then(
      (users) => {
        this.users.set(users);
        this.status.set('ready');
      },
      () => {
        this.status.set('error');
        this.loading = undefined;
      },
    );
    return this.loading;
  }

  retry(): Promise<void> {
    this.status.set('loading');
    return this.load();
  }

  select(userId: string): void {
    this.selectedId.set(userId);
    try {
      localStorage.setItem(DEMO_USER_STORAGE_KEY, userId);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this tab only.
    }
  }
}

function readStoredId(): string | null {
  try {
    return localStorage.getItem(DEMO_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}
