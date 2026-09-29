import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from './api/api-base-url';
import { SessionService } from './session.service';

export const DEMO_USER_HEADER = 'X-Demo-User';

/** Names the current demo user on every API request. Leaves other requests alone. */
export const demoUserInterceptor: HttpInterceptorFn = (req, next) => {
  const apiPrefix = `${inject(API_BASE_URL)}/api/`;
  const userId = inject(SessionService).currentUserId();
  if (!userId || !req.url.startsWith(apiPrefix)) return next(req);
  return next(req.clone({ setHeaders: { [DEMO_USER_HEADER]: userId } }));
};
