import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { AdminChannel, Channel } from '../models';
import { API_BASE_URL } from './api-base-url';

export abstract class ChannelsApi {
  /** Enabled channels only. Drives the channel picker and Settings. */
  abstract list(): Observable<Channel[]>;
  /** Admin: every registered channel with its enabled flag. */
  abstract listAll(): Observable<AdminChannel[]>;
  /** Admin: enable or disable a channel. */
  abstract setEnabled(channelId: string, enabled: boolean): Observable<AdminChannel>;
}

@Injectable()
export class HttpChannelsApi extends ChannelsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  list(): Observable<Channel[]> {
    return this.http.get<Channel[]>(`${this.base}/api/channels`);
  }

  listAll(): Observable<AdminChannel[]> {
    return this.http.get<AdminChannel[]>(`${this.base}/api/admin/channels`);
  }

  setEnabled(channelId: string, enabled: boolean): Observable<AdminChannel> {
    return this.http.patch<AdminChannel>(
      `${this.base}/api/admin/channels/${encodeURIComponent(channelId)}`,
      { enabled },
    );
  }
}
