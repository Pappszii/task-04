import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { UsersApi } from './core/api/users-api';
import { EVENT_SOURCE_FACTORY } from './core/realtime.service';
import { DEMO_USER_STORAGE_KEY } from './core/session.service';
import { FakeEventSource, fakeEventSourceFactory, FakeUsersApi } from './testing/fakes';

describe('App shell', () => {
  let api: FakeUsersApi;

  beforeEach(() => {
    localStorage.clear();
    FakeEventSource.reset();
    api = new FakeUsersApi();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: UsersApi, useValue: api },
        { provide: EVENT_SOURCE_FACTORY, useValue: fakeEventSourceFactory },
      ],
    });
  });

  const render = async (url = '/alerts') => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el };
  };

  const navLabels = (el: HTMLElement) =>
    [...el.querySelectorAll('nav[aria-label="Main"] a')].map((a) => a.textContent?.trim());

  const switcher = (el: HTMLElement) => el.querySelector<HTMLSelectElement>('select')!;

  const switchTo = async (fixture: Awaited<ReturnType<typeof render>>['fixture'], userId: string) => {
    const select = switcher(fixture.nativeElement as HTMLElement);
    select.value = userId;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };

  it('lists the demo users in the switcher, defaulting to the first', async () => {
    const { el } = await render();

    const options = [...switcher(el).options].map((o) => o.textContent?.trim());
    expect(options).toEqual(['Alice', 'Bob', 'Admin (admin)']);
    expect(switcher(el).value).toBe('u-alice');
    expect(el.querySelector('h1')?.textContent).toContain('Alerts');
  });

  it('hides the Admin link from a regular user and shows it to the admin (AC12)', async () => {
    const { fixture, el } = await render();
    expect(navLabels(el)).toEqual(['Alerts', 'Notifications', 'Settings']);

    await switchTo(fixture, 'u-admin');

    expect(navLabels(el)).toEqual(['Alerts', 'Notifications', 'Settings', 'Admin']);
    expect(localStorage.getItem(DEMO_USER_STORAGE_KEY)).toBe('u-admin');
  });

  it('leaves the admin page when switching to a regular user', async () => {
    localStorage.setItem(DEMO_USER_STORAGE_KEY, 'u-admin');
    const { fixture } = await render('/admin/channels');
    expect(TestBed.inject(Router).url).toBe('/admin/channels');

    await switchTo(fixture, 'u-bob');

    expect(TestBed.inject(Router).url).toBe('/alerts');
  });

  it('marks the current page link', async () => {
    const { el } = await render('/settings');

    const current = el.querySelector('nav[aria-label="Main"] a[aria-current="page"]');
    expect(current?.textContent?.trim()).toBe('Settings');
  });

  it('shows the live connection state as text', async () => {
    const { fixture, el } = await render();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Connecting');

    FakeEventSource.latest().open();
    await fixture.whenStable();

    expect(el.querySelector('[role="status"]')?.textContent).toContain('Live');
  });

  it('shows an error with a retry when the demo users cannot load', async () => {
    api.demoUsers$ = throwError(() => new Error('offline'));
    const { fixture, el } = await render();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Could not load the demo users');
    expect(el.querySelector('select')).toBeNull();

    api.demoUsers$ = new FakeUsersApi().demoUsers$;
    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(switcher(el).value).toBe('u-alice');
  });
});
