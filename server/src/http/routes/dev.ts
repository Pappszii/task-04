import { Router } from 'express';
import type { Container } from '../../container.js';
import { parseWorldEvent } from '../dev-events.js';

/** `POST /api/dev/events`: runs a hand-made event through the same path as the mock feeds. */
export function devRouter(container: Container): Router {
  const router = Router();

  router.post('/events', async (req, res) => {
    const parsed = parseWorldEvent(req.body);
    if (!parsed.ok) {
      res.status(400).json({ errors: parsed.errors });
      return;
    }
    await container.worldEvents.publish(parsed.event);
    res.status(201).json({ event: parsed.event });
  });

  return router;
}
