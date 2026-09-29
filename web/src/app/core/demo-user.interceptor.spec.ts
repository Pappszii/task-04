import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeUsersApi } from '../testing/fakes';
import { API_BASE_URL } from './api/api-base-url';
import { UsersApi } from './api/users-api';
import { demoUserInterceptor } from './demo-user.interceptor';
import { SessionService } from './session.service';

describe('demoUserInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  const setup = (baseUrl = '') => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([demoUserInterceptor])),
        provideHttpClientTesting(),
        { provide: UsersApi, useValue: new FakeUsersApi() },
        { provide: API_BASE_URL, useValue: baseUrl },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  };

  const selectUser = async (userId: string) => {
    const session = TestBed.inject(SessionService);
    await session.load();
    session.select(userId);
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => backend.verify());

  it('sends the current demo user on API requests', async () => {
    setup();
    await selectUser('u-bob');

    http.get('/api/rules').subscribe();

    expect(backend.expectOne('/api/rules').request.headers.get('X-Demo-User')).toBe('u-bob');
  });

  it('follows a user switch', async () => {
    setup();
    await selectUser('u-bob');
    TestBed.inject(SessionService).select('u-admin');

    http.get('/api/me').subscribe();

    expect(backend.expectOne('/api/me').request.headers.get('X-Demo-User')).toBe('u-admin');
  });

  it('does not touch requests outside the API', async () => {
    setup();
    await selectUser('u-bob');

    http.get('/assets/data.json').subscribe();
    http.get('https://example.com/api/rules').subscribe();

    expect(backend.expectOne('/assets/data.json').request.headers.has('X-Demo-User')).toBe(false);
    expect(backend.expectOne('https://example.com/api/rules').request.headers.has('X-Demo-User')).toBe(false);
  });

  it('sends no header before a user is known', () => {
    setup();

    http.get('/api/demo-users').subscribe();

    expect(backend.expectOne('/api/demo-users').request.headers.has('X-Demo-User')).toBe(false);
  });

  it('respects API_BASE_URL', async () => {
    setup('http://api.test');
    await selectUser('u-alice');

    http.get('http://api.test/api/rules').subscribe();

    expect(backend.expectOne('http://api.test/api/rules').request.headers.get('X-Demo-User')).toBe('u-alice');
  });
});
