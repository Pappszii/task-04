import { TestBed } from '@angular/core/testing';
import { provideRouter, type Routes } from '@angular/router';
import { ChannelsApi } from '../core/api/channels-api';
import { NotificationsApi } from '../core/api/notifications-api';
import { RulesApi } from '../core/api/rules-api';
import { UsersApi } from '../core/api/users-api';
import { EVENT_SOURCE_FACTORY } from '../core/realtime.service';
import { SessionService } from '../core/session.service';
import {
  FakeChannelsApi,
  FakeEventSource,
  fakeEventSourceFactory,
  FakeNotificationsApi,
  FakeRulesApi,
  FakeUsersApi,
} from './fakes';

export interface Fakes {
  users: FakeUsersApi;
  channels: FakeChannelsApi;
  rules: FakeRulesApi;
  notifications: FakeNotificationsApi;
}

/** Configures TestBed with a fake for every abstract API, a fake `EventSource`, and `routes`. */
export function setupFakes(routes: Routes = []): Fakes {
  localStorage.clear();
  FakeEventSource.reset();
  const fakes: Fakes = {
    users: new FakeUsersApi(() => TestBed.inject(SessionService).currentUserId()),
    channels: new FakeChannelsApi(),
    rules: new FakeRulesApi(),
    notifications: new FakeNotificationsApi(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: UsersApi, useValue: fakes.users },
      { provide: ChannelsApi, useValue: fakes.channels },
      { provide: RulesApi, useValue: fakes.rules },
      { provide: NotificationsApi, useValue: fakes.notifications },
      { provide: EVENT_SOURCE_FACTORY, useValue: fakeEventSourceFactory },
    ],
  });
  return fakes;
}

/** Loads the demo users and acts as `userId`. */
export async function actAs(userId: string): Promise<void> {
  const session = TestBed.inject(SessionService);
  await session.load();
  session.select(userId);
}

// DOM helpers. Each one fires the event Angular's form directives listen to.

export function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`no element matches ${selector}`);
  return element;
}

export function setValue(root: ParentNode, selector: string, value: string): void {
  const element = query<HTMLInputElement | HTMLSelectElement>(root, selector);
  element.value = value;
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input'));
}

export function textOf(root: ParentNode, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((e) => e.textContent?.replace(/\s+/g, ' ').trim() ?? '');
}
