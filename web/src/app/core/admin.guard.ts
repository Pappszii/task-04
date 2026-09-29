import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { HOME_URL } from './navigation';
import { SessionService } from './session.service';

/**
 * Lets only the admin demo user into `/admin/*`; everyone else is sent to the home page.
 * Waits for the demo users to load so a deep link to an admin page works on first load.
 * The server enforces the same rule; this only keeps the UI honest.
 */
export const adminGuard: CanMatchFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  await session.load();
  return session.isAdmin() ? true : router.parseUrl(HOME_URL);
};
