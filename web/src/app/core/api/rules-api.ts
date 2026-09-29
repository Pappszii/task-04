import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { AlertRule, AlertRuleInput } from '../models';
import { API_BASE_URL } from './api-base-url';

/** The current demo user's own alert rules. */
export abstract class RulesApi {
  abstract list(): Observable<AlertRule[]>;
  abstract create(input: AlertRuleInput): Observable<AlertRule>;
  /** Full replacement. */
  abstract update(id: string, input: AlertRuleInput): Observable<AlertRule>;
  abstract delete(id: string): Observable<void>;
}

@Injectable()
export class HttpRulesApi extends RulesApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  list(): Observable<AlertRule[]> {
    return this.http.get<AlertRule[]>(`${this.base}/api/rules`);
  }

  create(input: AlertRuleInput): Observable<AlertRule> {
    return this.http.post<AlertRule>(`${this.base}/api/rules`, input);
  }

  update(id: string, input: AlertRuleInput): Observable<AlertRule> {
    return this.http.put<AlertRule>(`${this.base}/api/rules/${encodeURIComponent(id)}`, input);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/rules/${encodeURIComponent(id)}`);
  }
}
