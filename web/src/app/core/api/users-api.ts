import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ContactUpdates, Contacts, DemoUser, Me } from '../models';
import { API_BASE_URL } from './api-base-url';

export abstract class UsersApi {
  /** Public: the seeded users for the header switcher. */
  abstract listDemoUsers(): Observable<DemoUser[]>;
  abstract me(): Observable<Me>;
  abstract updateContacts(updates: ContactUpdates): Observable<Contacts>;
}

@Injectable()
export class HttpUsersApi extends UsersApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  listDemoUsers(): Observable<DemoUser[]> {
    return this.http.get<DemoUser[]>(`${this.base}/api/demo-users`);
  }

  me(): Observable<Me> {
    return this.http.get<Me>(`${this.base}/api/me`);
  }

  updateContacts(updates: ContactUpdates): Observable<Contacts> {
    return this.http.put<Contacts>(`${this.base}/api/me/contacts`, updates);
  }
}
