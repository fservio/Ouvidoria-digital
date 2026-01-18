import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, Variables } from '../types/index.js';
import { simulateRouting } from '../services/routing/engine.js';

const routingRules = new Hono<{ Bindings: Env; Variables: Variables }>();

const createRuleSchema = z.object({
  name: z.string().min(1),
  priority: z.number().int().default(0),
  conditions: z.record(z.unknown()),
  actions: z.array(z.record(z.unknown())),
  description: z.string().optional(),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  priority: z.number().int().optional(),
  conditions: z.record(z.unknown()).optional(),
  actions: z.array(z.record(z.unknown())).optional(),
  description: z.string().optional(),
  enabled: z.number().int().optional(),
});

routingRules.get('/', async (c) => {
  const { enabled_only } = c.req.query();

  let query = 'SELECT * FROM routing_rules WHERE 1=1';
  const params: string[] = [];

  if (enabled_only === 'true') {
    query += ' AND enabled = 1';
  }

  query += ' ORDER BY priority DESC';

  const result = await c.env.DB.prepare(query).bind(...params).all();

  const rules = (result.results as Array<Record<string, unknown>>).map((rule) => ({
    ...rule,
    conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions as string) : rule.conditions,
    actions: typeof rule.actions === 'string' ? JSON.parse(rule.actions as string) : rule.actions,
  }));

  return c.json({ rules });
});

routingRules.get('/:id', async (c) => {
  const ruleId = c.req.param('id');

  const result = await c.env.DB
    .prepare('SELECT * FROM routing_rules WHERE id = ?')
    .bind(ruleId)
    .first();

  if (!result) {
    return c.json({ error: 'Rule not found' }, 404);
  }

  const rule = result as Record<string, unknown>;
  return c.json({
    rule: {
      ...rule,
      conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions as string) : rule.conditions,
      actions: typeof rule.actions === 'string' ? JSON.parse(rule.actions as string) : rule.actions,
    },
  });
});

routingRules.post('/', zValidator('json', createRuleSchema), async (c) => {
  const data = c.req.valid('json');

  const id = `rule_${Date.now()}`;

  await c.env.DB
    .prepare(
      `INSERT INTO routing_rules (id, name, priority, conditions, actions, description, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .bind(
      id,
      data.name,
      data.priority,
      JSON.stringify(data.conditions),
      JSON.stringify(data.actions),
      data.description || null
    )
    .run();

  return c.json({ ok: true, id });
});

routingRules.put('/:id', zValidator('json', updateRuleSchema), async (c) => {
  const ruleId = c.req.param('id');
  const updates = c.req.valid('json');

  const existing = await c.env.DB
    .prepare('SELECT * FROM routing_rules WHERE id = ?')
    .bind(ruleId)
    .first();

  if (!existing) {
    return c.json({ error: 'Rule not found' }, 404);
  }

  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.name) {
    setClauses.push('name = ?');
    params.push(updates.name);
  }

  if (updates.priority !== undefined) {
    setClauses.push('priority = ?');
    params.push(updates.priority);
  }

  if (updates.conditions) {
    setClauses.push('conditions = ?');
    params.push(JSON.stringify(updates.conditions));
  }

  if (updates.actions) {
    setClauses.push('actions = ?');
    params.push(JSON.stringify(updates.actions));
  }

  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    params.push(updates.description);
  }

  if (updates.enabled !== undefined) {
    setClauses.push('enabled = ?');
    params.push(updates.enabled);
  }

  if (setClauses.length > 0) {
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(ruleId);

    await c.env.DB
      .prepare(`UPDATE routing_rules SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
  }

  return c.json({ ok: true });
});

routingRules.delete('/:id', async (c) => {
  const ruleId = c.req.param('id');

  const existing = await c.env.DB
    .prepare('SELECT id FROM routing_rules WHERE id = ?')
    .bind(ruleId)
    .first();

  if (!existing) {
    return c.json({ error: 'Rule not found' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM routing_rules WHERE id = ?').bind(ruleId).run();

  return c.json({ ok: true });
});

routingRules.post('/:id/toggle', async (c) => {
  const ruleId = c.req.param('id');

  const existing = await c.env.DB
    .prepare('SELECT enabled FROM routing_rules WHERE id = ?')
    .bind(ruleId)
    .first();

  if (!existing) {
    return c.json({ error: 'Rule not found' }, 404);
  }

  const currentEnabled = (existing as { enabled: number }).enabled;
  const newEnabled = currentEnabled === 1 ? 0 : 1;

  await c.env.DB
    .prepare('UPDATE routing_rules SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(newEnabled, ruleId)
    .run();

  return c.json({ ok: true, enabled: newEnabled === 1 });
});

routingRules.post('/simulate', zValidator('json', z.object({
  message: z.string().min(1),
})), async (c) => {
  const { message } = c.req.valid('json');
  const result = await simulateRouting(message, c.env);
  return c.json({ result });
});

export { routingRules };
