import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RealtimeService, type RealtimeStatus } from './core/realtime.service';
import { SessionService } from './core/session.service';

interface NavLink {
  path: string;
  label: string;
}

const LIVE_STATUS: Record<RealtimeStatus, { label: string; dot: string } | null> = {
  idle: null,
  connecting: { label: 'Connecting…', dot: 'bg-warning' },
  open: { label: 'Live', dot: 'bg-success' },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-warning' },
  closed: { label: 'Offline', dot: 'bg-danger' },
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly session = inject(SessionService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);

  protected readonly links = computed<NavLink[]>(() => [
    { path: '/alerts', label: 'Alerts' },
    { path: '/notifications', label: 'Notifications' },
    { path: '/settings', label: 'Settings' },
    ...(this.session.isAdmin() ? [{ path: '/admin/channels', label: 'Admin' }] : []),
  ]);

  protected readonly liveStatus = computed(() => LIVE_STATUS[this.realtime.status()]);

  constructor() {
    void this.session.load();
  }

  protected selectUser(event: Event): void {
    this.session.select((event.target as HTMLSelectElement).value);
    // canMatch only runs on navigation, so leave admin pages ourselves when switching to a non-admin.
    if (!this.session.isAdmin() && this.router.url.startsWith('/admin')) {
      void this.router.navigateByUrl('/alerts');
    }
  }
}
