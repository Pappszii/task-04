import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { apiErrorMessages } from '../../core/api/api-errors';
import { NotificationsApi } from '../../core/api/notifications-api';
import { type AlertNotification, CATEGORY_LABELS, type NotificationStatus } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { SessionService } from '../../core/session.service';
import { EmptyState, ErrorState, LoadingState } from '../../ui/page-states';
import { StatusTag, type StatusTone } from '../../ui/status-tag';

interface FeedItem {
  notification: AlertNotification;
  /** Arrived over SSE while this page was open. */
  isNew: boolean;
}

const STATUS: Record<NotificationStatus, { label: string; tone: StatusTone }> = {
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'warning' },
};

@Component({
  selector: 'app-notifications-page',
  imports: [DatePipe, RouterLink, EmptyState, ErrorState, LoadingState, StatusTag],
  templateUrl: './notifications-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  private readonly api = inject(NotificationsApi);
  private readonly session = inject(SessionService);
  private readonly realtime = inject(RealtimeService);

  /** History at the time the page (or user) loaded. */
  protected readonly history = rxResource({
    params: () => this.session.currentUserId() ?? undefined,
    stream: () => this.api.list(),
  });

  /**
   * Live pushes first, then history, newest first. A push can also be in a list fetched after it
   * arrived, so pushes already in the history are dropped rather than shown twice.
   */
  protected readonly items = computed<FeedItem[]>(() => {
    const history = this.history.hasValue() ? this.history.value() : [];
    const known = new Set(history.map((n) => n.id));
    const live = this.realtime.notifications().filter((n) => !known.has(n.id));
    return [
      ...live.map((notification) => ({ notification, isNew: true })),
      ...history.map((notification) => ({ notification, isNew: false })),
    ];
  });

  /** Announced to screen readers when a new notification arrives. */
  protected readonly latestAnnouncement = computed(() => {
    const [latest] = this.realtime.notifications();
    if (!latest) return '';
    return `New notification: ${latest.event.title}, ${latest.channelName}, ${STATUS[latest.status].label}.`;
  });

  protected readonly status = STATUS;
  protected readonly categoryLabels = CATEGORY_LABELS;

  protected errorMessages(): string[] {
    return apiErrorMessages(this.history.error());
  }
}
