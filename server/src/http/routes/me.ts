import { Router } from 'express';
import type { Container } from '../../container.js';
import { applyContactUpdates, parseContactsInput } from '../contacts-input.js';
import { currentUser } from '../identity.js';

/** `/api/me`: the demo user and their contact destinations. Mount behind `identify()`. */
export function meRouter(container: Container): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(currentUser(res));
  });

  router.get('/contacts', (_req, res) => {
    res.json(currentUser(res).contacts);
  });

  // Channels not in the body keep their destination; '' or null clears one.
  router.put('/contacts', async (req, res) => {
    const parsed = parseContactsInput(req.body, container.registry);
    if (!parsed.ok) {
      res.status(400).json({ errors: parsed.errors });
      return;
    }
    const user = currentUser(res);
    const updated = await container.users.setContacts(user.id, applyContactUpdates(user.contacts, parsed.updates));
    res.json(updated?.contacts ?? {});
  });

  return router;
}
