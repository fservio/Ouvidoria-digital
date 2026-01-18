import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, Variables } from '../types/index.js';

const queues = new Hono<{ Bindings: Env; Variables: Variables }>();

const createQueueSchema = z.object({
  secretariat_id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().default(0),
  sla_hours: z.number().int().default(48),
});

const updateQueueSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  sla_hours: z.number().int().optional(),
  is_active: z.number().int().optional(),
});

queues.get('/', async (c) => {
  const { secretariat_id, active_only } = c.req.query();

  let query = `
    SELECT q.*, s.name as secretariat_name, s.code as secretariat_code
    FROM queues q
    JOIN secretariats s ON q.secretariat_id = s.id
    WHERE 1=1
  `;

  const params: string[] = [];

  if (secretariat_id) {
    query += ' AND q.secretariat_id = ?';
    params.push(secretariat_id);
  }

  if (active_only === 'true') {
    query += ' AND q.is_active = 1 AND s.is_active = 1';
  }

  query += ' ORDER BY s.name, q.priority DESC';

  const result = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ queues: result.results });
});

queues.get('/:id', async (c) => {
  const queueId = c.req.param('id');

  const result = await c.env.DB
    .prepare(
      `SELECT q.*, s.name as secretariat_name, s.code as secretariat_code
       FROM queues q
       JOIN secretariats s ON q.secretariat_id = s.id
       WHERE q.id = ?`
    )
    .bind(queueId)
    .first();

  if (!result) {
    return c.json({ error: 'Queue not found' }, 404);
  }

  return c.json({ queue: result });
});

queues.post('/', zValidator('json', createQueueSchema), async (c) => {
  const data = c.req.valid('json');

  const existing = await c.env.DB
    .prepare('SELECT id FROM queues WHERE secretariat_id = ? AND slug = ?')
    .bind(data.secretariat_id, data.slug)
    .first();

  if (existing) {
    return c.json({ error: 'Queue with this slug already exists for this secretariat' }, 409);
  }

  const id = `q_${data.slug.toLowerCase()}`;

  await c.env.DB
    .prepare(
      `INSERT INTO queues (id, secretariat_id, name, slug, description, priority, sla_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, data.secretariat_id, data.name, data.slug, data.description || null, data.priority, data.sla_hours)
    .run();

  return c.json({ ok: true, id });
});

queues.put('/:id', zValidator('json', updateQueueSchema), async (c) => {
  const queueId = c.req.param('id');
  const updates = c.req.valid('json');

  const existing = await c.env.DB
    .prepare('SELECT * FROM queues WHERE id = ?')
    .bind(queueId)
    .first();

  if (!existing) {
    return c.json({ error: 'Queue not found' }, 404);
  }

  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (setClauses.length > 0) {
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(queueId);

    await c.env.DB
      .prepare(`UPDATE queues SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
  }

  return c.json({ ok: true });
});

queues.delete('/:id', async (c) => {
  const queueId = c.req.param('id');

  const existing = await c.env.DB
    .prepare('SELECT id FROM queues WHERE id = ?')
    .bind(queueId)
    .first();

  if (!existing) {
    return c.json({ error: 'Queue not found' }, 404);
  }

  const activeCases = await c.env.DB
    .prepare('SELECT COUNT(*) as count FROM cases WHERE queue_id = ? AND status NOT IN (?, ?)')
    .bind(queueId, 'resolved', 'closed')
    .first();

  if ((activeCases as { count: number }).count > 0) {
    return c.json({ error: 'Cannot delete queue with active cases' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM queues WHERE id = ?').bind(queueId).run();

  return c.json({ ok: true });
});

export { queues };
