import { Router } from 'express';
import type { Container } from '../../container.js';
import { isObject } from '../validation.js';

export interface ChannelView {
  id: string;
  displayName: string;
  destinationKind: string;
  enabled: boolean;
}

async function listChannelViews(container: Container): Promise<ChannelView[]> {
  return Promise.all(
    container.registry.list().map(async (channel) => ({
      id: channel.id,
      displayName: channel.displayName,
      destinationKind: channel.destinationKind,
      enabled: await container.channelSettings.isEnabled(channel.id),
    })),
  );
}

/** `GET /api/channels`: enabled channels and what each needs. Drives the channel picker and Settings. */
export function channelsRouter(container: Container): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const views = await listChannelViews(container);
    res.json(views.filter((c) => c.enabled).map(({ enabled: _enabled, ...channel }) => channel));
  });

  return router;
}

/** `/api/admin/channels`: every registered channel, with enable/disable. Mount behind `adminOnly`. */
export function adminChannelsRouter(container: Container): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await listChannelViews(container));
  });

  router.patch('/:id', async (req, res) => {
    const channel = container.registry.get(req.params.id);
    if (!channel) {
      res.status(404).json({ error: `unknown channel: ${req.params.id}` });
      return;
    }
    const body: unknown = req.body;
    if (!isObject(body) || typeof body['enabled'] !== 'boolean') {
      res.status(400).json({ errors: ['enabled must be a boolean'] });
      return;
    }
    const state = await container.channelSettings.setEnabled(channel.id, body['enabled']);
    await container.channelEvents.publish(state);
    res.json({
      id: channel.id,
      displayName: channel.displayName,
      destinationKind: channel.destinationKind,
      enabled: state.enabled,
    } satisfies ChannelView);
  });

  return router;
}
