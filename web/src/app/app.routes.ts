import type { Routes } from '@angular/router';
import { adminGuard } from './core/admin.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'alerts' },
  {
    path: 'alerts',
    title: 'Alerts · World Alerts',
    loadComponent: () => import('./pages/alerts/alerts-page').then((m) => m.AlertsPage),
  },
  {
    path: 'notifications',
    title: 'My notifications · World Alerts',
    loadComponent: () =>
      import('./pages/notifications/notifications-page').then((m) => m.NotificationsPage),
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
  { path: '**', redirectTo: 'alerts' },
];
