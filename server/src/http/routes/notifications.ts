import { Router } from 'express';
import type { Container } from '../../container.js';
import { currentUser } from '../identity.js';

/** `GET /api/notifications`: the demo user's own delivery history, newest first. Mount behind `identify()`. */
export function notificationsRouter(container: Container): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await container.notifications.listByUser(currentUser(res).id));
  });

  return router;
}
