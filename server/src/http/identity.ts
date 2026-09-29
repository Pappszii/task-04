import type { RequestHandler, Response } from 'express';
import type { Container } from '../container.js';
import type { User } from '../domain/index.js';

declare global {
  namespace Express {
    interface Locals {
      user?: User;
    }
  }
}

export const DEMO_USER_HEADER = 'X-Demo-User';

/**
 * No real auth: the caller names a seeded user in `X-Demo-User`.
 * `allowQuery` also accepts `?userId=`, for SSE, because `EventSource` cannot set headers.
 */
export function identify(container: Container, options: { allowQuery?: boolean } = {}): RequestHandler {
  return async (req, res, next) => {
    const query = req.query['userId'];
    const id = req.get(DEMO_USER_HEADER) ?? (options.allowQuery && typeof query === 'string' ? query : undefined);
    if (!id) {
      res.status(401).json({ error: `missing ${DEMO_USER_HEADER} header` });
      return;
    }
    const user = await container.users.getById(id);
    if (!user) {
      res.status(401).json({ error: `unknown demo user "${id}"` });
      return;
    }
    res.locals.user = user;
    next();
  };
}

export const adminOnly: RequestHandler = (_req, res, next) => {
  if (res.locals.user?.role !== 'admin') {
    res.status(403).json({ error: 'admin only' });
    return;
  }
  next();
};

/** The user set by `identify()`. Throws if the route is not behind it (a wiring bug, not a client error). */
export function currentUser(res: Response): User {
  const user = res.locals.user;
  if (!user) throw new Error('currentUser() called on a route without identify()');
  return user;
}
