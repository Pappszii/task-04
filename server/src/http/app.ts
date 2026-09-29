import express from 'express';
import type { Container } from '../container.js';

export function createApp(container: Container): express.Express {
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

  return app;
}
