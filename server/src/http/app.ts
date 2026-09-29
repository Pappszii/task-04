import express from 'express';
import type { Container } from '../container.js';
import { parseWorldEvent } from './dev-events.js';

export interface AppOptions {
  /** Mounts `POST /api/dev/events`. Defaults to on outside production. */
  devRoutes?: boolean;
}

export function createApp(container: Container, options: AppOptions = {}): express.Express {
  const devRoutes = options.devRoutes ?? process.env['NODE_ENV'] !== 'production';
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Drives the channel picker and Settings in the UI: enabled channels and what each needs.
  app.get('/api/channels', async (_req, res) => {
    const channels = container.registry.list();
    const enabled = await Promise.all(
      channels.map(async (channel) => ({
        channel,
        enabled: await container.channelSettings.isEnabled(channel.id),
      })),
    );
    res.json(
      enabled
        .filter((entry) => entry.enabled)
        .map(({ channel }) => ({
          id: channel.id,
          displayName: channel.displayName,
          destinationKind: channel.destinationKind,
        })),
    );
  });

  if (devRoutes) {
    // Demo trigger: runs a hand-made event through the same path as the mock feeds.
    app.post('/api/dev/events', async (req, res) => {
      const parsed = parseWorldEvent(req.body);
      if (!parsed.ok) {
        res.status(400).json({ errors: parsed.errors });
        return;
      }
      await container.worldEvents.publish(parsed.event);
      res.status(201).json({ event: parsed.event });
    });
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.parse.failed') {
      res.status(400).json({ errors: ['body is not valid JSON'] });
      return;
    }
    next(error);
  });

  return app;
}
