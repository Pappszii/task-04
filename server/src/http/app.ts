import express, { type ErrorRequestHandler } from 'express';
import type { Container } from '../container.js';
import { adminOnly, identify } from './identity.js';
import { adminChannelsRouter, channelsRouter } from './routes/channels.js';
import { devRouter } from './routes/dev.js';
import { meRouter } from './routes/me.js';
import { notificationsRouter } from './routes/notifications.js';
import { rulesRouter } from './routes/rules.js';
import { streamHandler } from './routes/stream.js';

export interface AppOptions {
  /** Mounts `POST /api/dev/events`. Defaults to on outside production. */
  devRoutes?: boolean;
}

/**
 * Error bodies: `{ errors: string[] }` for 400 validation failures, `{ error: string }` otherwise.
 */
export function createApp(container: Container, options: AppOptions = {}): express.Express {
  const devRoutes = options.devRoutes ?? process.env['NODE_ENV'] !== 'production';
  const app = express();
  app.use(express.json());

  // Public: no demo user needed.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  // Feeds the header user switcher.
  app.get('/api/demo-users', async (_req, res) => {
    const users = await container.users.list();
    res.json(users.map(({ id, name, role }) => ({ id, name, role })));
  });
  app.use('/api/channels', channelsRouter(container));
  if (devRoutes) app.use('/api/dev', devRouter(container));
  app.get('/api/stream', identify(container, { allowQuery: true }), streamHandler(container));

  // Everything below needs `X-Demo-User`.
  app.use('/api', identify(container));
  app.use('/api/me', meRouter(container));
  app.use('/api/rules', rulesRouter(container));
  app.use('/api/notifications', notificationsRouter(container));
  app.use('/api/admin', adminOnly);
  app.use('/api/admin/channels', adminChannelsRouter(container));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not found' });
  });
  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (isClientError(error)) {
    const message = error.type === 'entity.parse.failed' ? 'body is not valid JSON' : error.message;
    res.status(error.status).json({ errors: [message] });
    return;
  }
  console.error('[http] unhandled error', error);
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).json({ error: 'internal error' });
};

/** A 4xx raised by `express.json()` (bad JSON, body too large, ...). */
function isClientError(error: unknown): error is { status: number; type?: string; message: string } {
  if (typeof error !== 'object' || error === null || !('status' in error)) return false;
  const { status } = error;
  return typeof status === 'number' && status >= 400 && status < 500 && error instanceof Error;
}
