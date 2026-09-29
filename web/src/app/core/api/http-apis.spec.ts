import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AlertRuleInput } from '../models';
import { API_BASE_URL } from './api-base-url';
import { ChannelsApi } from './channels-api';
import { NotificationsApi } from './notifications-api';
import { provideHttpApi } from './provide-api';
import { RulesApi } from './rules-api';
import { UsersApi } from './users-api';

const BASE = 'http://api.test';

describe('HTTP API implementations', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideHttpApi(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Subscribes, checks the one request made, answers it, and returns the parsed result. */
  async function call<T>(
    request: Observable<T>,
    expected: { method: string; url: string; body?: unknown },
    response: Parameters<TestRequest['flush']>[0],
  ): Promise<T> {
    const result = firstValueFrom(request);
    const req = backend.expectOne(expected.url);
    expect(req.request.method).toBe(expected.method);
    if ('body' in expected) expect(req.request.body).toEqual(expected.body);
    req.flush(response);
    return result;
  }

  const input: AlertRuleInput = {
    category: 'markets',
    keywords: [],
    minSeverity: 2,
    symbol: 'ACME',
    minPercentMove: 3,
    channelIds: ['email'],
    enabled: true,
  };

  it('UsersApi', async () => {
    const api = TestBed.inject(UsersApi);
    const users = [{ id: 'u-1', name: 'One', role: 'user' }];

    expect(await call(api.listDemoUsers(), { method: 'GET', url: `${BASE}/api/demo-users` }, users)).toEqual(users);
    await call(api.me(), { method: 'GET', url: `${BASE}/api/me` }, {});
    await call(
      api.updateContacts({ email: 'a@b.co', slack: null }),
      { method: 'PUT', url: `${BASE}/api/me/contacts`, body: { email: 'a@b.co', slack: null } },
      { email: 'a@b.co' },
    );
  });

  it('ChannelsApi', async () => {
    const api = TestBed.inject(ChannelsApi);

    await call(api.list(), { method: 'GET', url: `${BASE}/api/channels` }, []);
    await call(api.listAll(), { method: 'GET', url: `${BASE}/api/admin/channels` }, []);
    await call(
      api.setEnabled('team/chat', false),
      { method: 'PATCH', url: `${BASE}/api/admin/channels/team%2Fchat`, body: { enabled: false } },
      {},
    );
  });

  it('RulesApi', async () => {
    const api = TestBed.inject(RulesApi);

    await call(api.list(), { method: 'GET', url: `${BASE}/api/rules` }, []);
    await call(api.create(input), { method: 'POST', url: `${BASE}/api/rules`, body: input }, {});
    await call(api.update('r 1', input), { method: 'PUT', url: `${BASE}/api/rules/r%201`, body: input }, {});
    await call(api.delete('r 1'), { method: 'DELETE', url: `${BASE}/api/rules/r%201` }, null);
  });

  it('NotificationsApi', async () => {
    const api = TestBed.inject(NotificationsApi);

    await call(api.list(), { method: 'GET', url: `${BASE}/api/notifications` }, []);
  });
});
