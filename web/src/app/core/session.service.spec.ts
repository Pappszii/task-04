import { TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_USERS, FakeUsersApi } from '../testing/fakes';
import { UsersApi } from './api/users-api';
import type { DemoUser } from './models';
import { DEMO_USER_STORAGE_KEY, SessionService } from './session.service';

describe('SessionService', () => {
  let api: FakeUsersApi;

  const create = () => {
    TestBed.configureTestingModule({ providers: [{ provide: UsersApi, useValue: api }] });
    return TestBed.inject(SessionService);
  };

  beforeEach(() => {
    localStorage.clear();
    api = new FakeUsersApi();
  });

  it('is loading, with no user, until the demo users arrive', async () => {
    const pending = new Subject<DemoUser[]>();
    api.demoUsers$ = pending;
    const session = create();

    const loaded = session.load();
    expect(session.status()).toBe('loading');
    expect(session.currentUserId()).toBeNull();

    pending.next(DEMO_USERS);
    pending.complete();
    await loaded;

    expect(session.status()).toBe('ready');
    expect(session.users()).toEqual(DEMO_USERS);
  });

  it('defaults to the first user when nothing is stored', async () => {
    const session = create();
    await session.load();

    expect(session.currentUserId()).toBe('u-alice');
    expect(session.isAdmin()).toBe(false);
  });

  it('restores the stored user', async () => {
    localStorage.setItem(DEMO_USER_STORAGE_KEY, 'u-admin');
    const session = create();
    await session.load();

    expect(session.currentUser()).toEqual({ id: 'u-admin', name: 'Admin', role: 'admin' });
    expect(session.isAdmin()).toBe(true);
  });

  it('falls back to the first user when the stored one no longer exists', async () => {
    localStorage.setItem(DEMO_USER_STORAGE_KEY, 'u-deleted');
    const session = create();
    await session.load();

    expect(session.currentUserId()).toBe('u-alice');
  });

  it('select() switches the user and remembers the choice', async () => {
    const session = create();
    await session.load();

    session.select('u-admin');

    expect(session.currentUserId()).toBe('u-admin');
    expect(session.isAdmin()).toBe(true);
    expect(localStorage.getItem(DEMO_USER_STORAGE_KEY)).toBe('u-admin');
  });

  it('loads only once however often load() is called', async () => {
    const session = create();

    await Promise.all([session.load(), session.load()]);
    await session.load();

    expect(api.listDemoUsersCalls).toBe(1);
  });

  it('reports an error, and retry() loads again', async () => {
    api.demoUsers$ = throwError(() => new Error('offline'));
    const session = create();

    await session.load();
    expect(session.status()).toBe('error');

    api.demoUsers$ = new FakeUsersApi().demoUsers$;
    await session.retry();

    expect(session.status()).toBe('ready');
    expect(api.listDemoUsersCalls).toBe(2);
  });
});
