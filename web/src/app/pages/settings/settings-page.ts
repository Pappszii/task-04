import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { apiErrorMessages } from '../../core/api/api-errors';
import { UsersApi } from '../../core/api/users-api';
import { AvailableChannels } from '../../core/available-channels';
import type { Channel, ContactUpdates, Contacts } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { EmptyState, ErrorState, LoadingState } from '../../ui/page-states';
import { ToastService } from '../../ui/toast.service';

/**
 * Contact destinations, one field per channel offered by `GET /api/channels`.
 * The page knows nothing about any particular channel; each channel validates its own format on the server.
 */
@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, EmptyState, ErrorState, LoadingState],
  templateUrl: './settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly api = inject(UsersApi);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  protected readonly channels = inject(AvailableChannels);

  protected readonly me = rxResource({
    params: () => this.session.currentUserId() ?? undefined,
    stream: () => this.api.me(),
  });

  protected readonly form = new FormRecord<FormControl<string>>({});
  /** Channels that have a field right now; the template renders from this. */
  protected readonly fields = signal<Channel[]>([]);
  protected readonly saving = signal(false);
  protected readonly errors = signal<string[]>([]);
  private formUserId: string | null = null;

  /** Server errors look like "Email: expected an email address"; this attaches them to the right field. */
  protected readonly fieldErrors = computed(() => {
    const byChannel = new Map<string, string>();
    for (const message of this.errors()) {
      const channel = this.fields().find((c) => message.startsWith(`${c.displayName}: `));
      if (!channel) continue;
      const detail = message.slice(channel.displayName.length + 2);
      byChannel.set(channel.id, detail.charAt(0).toUpperCase() + detail.slice(1) + '.');
    }
    return byChannel;
  });

  protected readonly loadError = computed(() => this.me.error() ?? this.channels.resource.error());
  protected readonly loading = computed(() => !this.me.hasValue() || !this.channels.resource.hasValue());

  constructor() {
    // Keep one field per offered channel, filled from the saved contacts.
    effect(() => {
      const channels = this.channels.list();
      const me = this.me.hasValue() ? this.me.value() : undefined;
      if (!me) return;
      untracked(() => this.syncFields(channels, me.id, me.contacts));
    });
  }

  protected save(): void {
    const updates: ContactUpdates = {};
    for (const channel of this.fields()) {
      const value = this.form.controls[channel.id]?.value.trim() ?? '';
      updates[channel.id] = value === '' ? null : value;
    }

    this.saving.set(true);
    this.errors.set([]);
    this.api.updateContacts(updates).subscribe({
      next: (contacts) => {
        this.saving.set(false);
        this.me.value.update((me) => (me ? { ...me, contacts } : me));
        this.form.markAsPristine();
        this.toast.success('Settings saved.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errors.set(apiErrorMessages(error));
      },
    });
  }

  protected retry(): void {
    if (this.me.error()) this.me.reload();
    if (this.channels.resource.error()) this.channels.resource.reload();
  }

  protected hasDestination(channelId: string): boolean {
    return (this.form.controls[channelId]?.value.trim() ?? '') !== '';
  }

  /**
   * Adds and removes fields to match `channels`. Fields the user has edited keep their text, unless
   * the demo user changed, in which case everything is reset.
   */
  private syncFields(channels: Channel[], userId: string, contacts: Contacts): void {
    const userChanged = userId !== this.formUserId;
    this.formUserId = userId;
    if (userChanged) this.errors.set([]);

    for (const id of Object.keys(this.form.controls)) {
      if (!channels.some((c) => c.id === id)) this.form.removeControl(id);
    }
    for (const channel of channels) {
      const saved = contacts[channel.id] ?? '';
      const control = this.form.controls[channel.id];
      if (!control) {
        this.form.addControl(channel.id, new FormControl(saved, { nonNullable: true }));
      } else if (userChanged || control.pristine) {
        control.reset(saved);
      }
    }
    this.fields.set(channels);
  }
}
