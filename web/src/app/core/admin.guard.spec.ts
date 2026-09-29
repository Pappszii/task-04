import { TestBed } from '@angular/core/testing';
import { type CanMatchFn, Router, type Route, UrlTree } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../app.routes';
import { AdminChannelsPage } from '../pages/admin/admin-channels-page';
import { DEMO_USERS, type FakeUsersApi } from '../testing/fakes';
import { setupFakes } from '../testing/setup';
import { adminGuard } from './admin.guard';
import type { DemoUser } from './models';
import { SessionService } from './session.service';

describe('adminGuard (AC12)', () => {
  let api: FakeUsersApi;

  beforeEach(() => {
    api = setupFakes(routes).users;
  });

  // The guard ignores its arguments, so empty stand-ins are enough.
  const runGuard = () =>
    TestBed.runInInjectionContext(() =>
      adminGuard({} as Route, [], {} as Parameters<CanMatchFn>[2]),
    ) as Promise<boolean | UrlTree>;

  const asUser = async (userId: string) => {
    const session = TestBed.inject(SessionService);
    await session.load();
    session.select(userId);
  };

  it('lets the admin in', async () => {
    await asUser('u-admin');

    expect(await runGuard()).toBe(true);
  });

  it('redirects a non-admin to the feed', async () => {
    await asUser('u-alice');

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/feed');
  });

  it('waits for the demo users before deciding', async () => {
    const pending = new Subject<DemoUser[]>();
    api.demoUsers$ = pending;
    TestBed.inject(SessionService).select('u-admin');

    let settled = false;
    const result = runGuard().then((r) => {
      settled = true;
      return r;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    pending.next(DEMO_USERS);
    pending.complete();
    expect(await result).toBe(true);
  });

  it('redirects when the demo users fail to load', async () => {
    api.demoUsers$ = throwError(() => new Error('offline'));

    expect(await runGuard()).toBeInstanceOf(UrlTree);
  });

  describe('through the router', () => {
    it('a non-admin opening /admin/channels lands on the feed', async () => {
      await asUser('u-bob');
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/admin/channels');

      expect(TestBed.inject(Router).url).toBe('/feed');
    });

    it('the admin opening /admin/channels sees the page', async () => {
      await asUser('u-admin');
      const harness = await RouterTestingHarness.create();

      const page = await harness.navigateByUrl('/admin/channels', AdminChannelsPage);

      expect(page).toBeInstanceOf(AdminChannelsPage);
      expect(TestBed.inject(Router).url).toBe('/admin/channels');
    });
  });
});
