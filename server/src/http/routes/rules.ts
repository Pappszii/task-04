import { Router, type Response } from 'express';
import type { Container } from '../../container.js';
import type { AlertRule } from '../../domain/index.js';
import { currentUser } from '../identity.js';
import { parseRuleInput } from '../rule-input.js';

/**
 * `/api/rules`: the demo user's own alert rules. Mount behind `identify()`.
 * Another user's rule answers 404, the same as a missing one, so ids don't leak.
 */
export function rulesRouter(container: Container): Router {
  const router = Router();

  const knownChannelIds = () => new Set(container.registry.list().map((c) => c.id));

  const findOwn = async (res: Response, id: string): Promise<AlertRule | undefined> => {
    const rule = await container.rules.getById(id);
    return rule?.userId === currentUser(res).id ? rule : undefined;
  };

  const notFound = (res: Response, id: string) => {
    res.status(404).json({ error: `rule not found: ${id}` });
  };

  router.get('/', async (_req, res) => {
    res.json(await container.rules.listByUser(currentUser(res).id));
  });

  router.get('/:id', async (req, res) => {
    const rule = await findOwn(res, req.params.id);
    if (!rule) return notFound(res, req.params.id);
    res.json(rule);
  });

  router.post('/', async (req, res) => {
    const parsed = parseRuleInput(req.body, knownChannelIds());
    if (!parsed.ok) {
      res.status(400).json({ errors: parsed.errors });
      return;
    }
    const created = await container.rules.create({ ...parsed.rule, userId: currentUser(res).id });
    res.status(201).json(created);
  });

  // Full replacement; `id` and `userId` always come from the stored rule, never the body.
  router.put('/:id', async (req, res) => {
    const existing = await findOwn(res, req.params.id);
    if (!existing) return notFound(res, req.params.id);
    const parsed = parseRuleInput(req.body, knownChannelIds());
    if (!parsed.ok) {
      res.status(400).json({ errors: parsed.errors });
      return;
    }
    const updated = await container.rules.update({ ...parsed.rule, id: existing.id, userId: existing.userId });
    if (!updated) return notFound(res, req.params.id);
    res.json(updated);
  });

  router.delete('/:id', async (req, res) => {
    const existing = await findOwn(res, req.params.id);
    if (!existing) return notFound(res, req.params.id);
    await container.rules.delete(existing.id);
    res.status(204).end();
  });

  return router;
}
