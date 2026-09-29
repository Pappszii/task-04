import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { AlertNotification } from '../models';
import { API_BASE_URL } from './api-base-url';

export abstract class NotificationsApi {
  /** The current demo user's delivery history, newest first. */
  abstract list(): Observable<AlertNotification[]>;
}

@Injectable()
export class HttpNotificationsApi extends NotificationsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  list(): Observable<AlertNotification[]> {
    return this.http.get<AlertNotification[]>(`${this.base}/api/notifications`);
  }
}
