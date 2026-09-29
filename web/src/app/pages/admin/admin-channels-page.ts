import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { apiErrorMessages } from '../../core/api/api-errors';
import { ChannelsApi } from '../../core/api/channels-api';
import { BusySet } from '../../core/busy-set';
import type { AdminChannel } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { EmptyState, ErrorState, LoadingState } from '../../ui/page-states';
import { StatusTag } from '../../ui/status-tag';
import { ToastService } from '../../ui/toast.service';

/**
 * Admin: every registered channel, with a switch to enable or disable it for everyone.
 * Rendered from `GET /api/admin/channels`; no channel is known here by name.
 */
@Component({
  selector: 'app-admin-channels-page',
  imports: [EmptyState, ErrorState, LoadingState, StatusTag],
  templateUrl: './admin-channels-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminChannelsPage {
  private readonly api = inject(ChannelsApi);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);

  protected readonly channels = rxResource({ stream: () => this.api.listAll() });
  protected readonly busy = new BusySet();

  constructor() {
    // A toggle from another admin tab arrives over SSE; apply it without refetching.
    effect(() => {
      const change = this.realtime.lastChannelChange();
      if (!change) return;
      untracked(() => this.patch(change.channelId, { enabled: change.enabled }));
    });
  }

  protected toggle(channel: AdminChannel, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.busy.add(channel.id);
    this.api.setEnabled(channel.id, checkbox.checked).subscribe({
      next: (updated) => {
        this.busy.delete(channel.id);
        this.patch(updated.id, updated);
        this.toast.success(`${updated.displayName} ${updated.enabled ? 'enabled' : 'disabled'}.`);
      },
      error: (error: unknown) => {
        this.busy.delete(channel.id);
        checkbox.checked = channel.enabled;
        this.toast.error(`Could not update ${channel.displayName}: ${apiErrorMessages(error).join(' ')}`);
      },
    });
  }

  protected errorMessages(): string[] {
    return apiErrorMessages(this.channels.error());
  }

  private patch(channelId: string, changes: Partial<AdminChannel>): void {
    // Writing to a resource that has not loaded would replace its pending load.
    if (!this.channels.hasValue()) return;
    this.channels.value.update((list) => list?.map((c) => (c.id === channelId ? { ...c, ...changes } : c)));
  }
}
