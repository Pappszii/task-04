import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ChannelsApi } from './api/channels-api';
import type { Channel } from './models';
import { RealtimeService } from './realtime.service';

/**
 * The enabled channels, from `GET /api/channels`. Reloads whenever an admin toggles a channel
 * (SSE `channel-changed`), so the channel picker and Settings update without a refresh.
 */
@Injectable({ providedIn: 'root' })
export class AvailableChannels {
  private readonly api = inject(ChannelsApi);
  private readonly realtime = inject(RealtimeService);

  readonly resource = rxResource({ stream: () => this.api.list() });

  /** The channels, or an empty list while first loading or after an error. */
  readonly list = computed<Channel[]>(() => (this.resource.hasValue() ? this.resource.value() : []));

  constructor() {
    // reload(), not a params change: it keeps the current list on screen until the new one arrives.
    effect(() => {
      if (this.realtime.lastChannelChange()) untracked(() => this.resource.reload());
    });
  }
}
