import type { Routes } from '@angular/router';
import { adminGuard } from './core/admin.guard';
import { HOME_URL } from './core/navigation';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: HOME_URL },
  {
    path: 'feed',
    title: 'Feed · World Alerts',
    loadComponent: () => import('./pages/feed/feed-page').then((m) => m.FeedPage),
  },
  {
    path: 'alerts',
    title: 'Alerts · World Alerts',
    loadComponent: () => import('./pages/alerts/alerts-page').then((m) => m.AlertsPage),
  },
  {
    path: 'settings',
    title: 'Settings · World Alerts',
    loadComponent: () => import('./pages/settings/settings-page').then((m) => m.SettingsPage),
  },
  {
    path: 'admin',
    canMatch: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'channels' },
      {
        path: 'channels',
        title: 'Channels · Admin · World Alerts',
        loadComponent: () =>
          import('./pages/admin/admin-channels-page').then((m) => m.AdminChannelsPage),
      },
    ],
  },
  { path: '**', redirectTo: HOME_URL },
];
