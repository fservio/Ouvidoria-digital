import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, Variables } from '../types/index.js';

const secretariats = new Hono<{ Bindings: Env; Variables: Variables }>();

const createSecretariatSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  sla_hours: z.number().int().default(72),
});

const updateSecretariatSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sla_hours: z.number().int().optional(),
  is_active: z.number().int().optional(),
});

secretariats.get('/', async (c) => {
  const { active_only } = c.req.query();

  let query = 'SELECT * FROM secretariats WHERE 1=1';
  const params: string[] = [];

  if (active_only === 'true') {
    query += ' AND is_active = 1';
  }

  query += ' ORDER BY name';

  const result = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ secretariats: result.results });
});

secretariats.get('/:id', async (c) => {
  const secretariatId = c.req.param('id');

  const result = await c.env.DB
    .prepare('SELECT * FROM secretariats WHERE id = ?')
    .bind(secretariatId)
    .first();

  if (!result) {
    return c.json({ error: 'Secretariat not found' }, 404);
  }

  const queuesResult = await c.env.DB
    .prepare('SELECT * FROM queues WHERE secretariat_id = ? AND is_active = 1 ORDER BY priority DESC')
    .bind(secretariatId)
    .all();

  const statsResult = await c.env.DB
    .prepare(
      `SELECT
         COUNT(*) as total_cases,
         SUM(CASE WHEN status IN ('new', 'routing', 'assigned', 'in_progress') THEN 1 ELSE 0 END) as open_cases,
         SUM(CASE WHEN sla_breached = 1 THEN 1 ELSE 0 END) as breached_sla
       FROM cases c
       JOIN queues q ON c.queue_id = q.id
       WHERE q.secretariat_id = ?`
    )
    .bind(secretariatId)
    .first();

  return c.json({
    secretariat: result,
    queues: queuesResult.results,
    stats: statsResult,
  });
});

secretariats.post('/', zValidator('json', createSecretariatSchema), async (c) => {
  const data = c.req.valid('json');

  const existing = await c.env.DB
    .prepare('SELECT id FROM secretariats WHERE code = ?')
    .bind(data.code)
    .first();

  if (existing) {
    return c.json({ error: 'Secretariat with this code already exists' }, 409);
  }

  const id = `sec_${data.code.toLowerCase()}`;

  await c.env.DB
    .prepare(
      `INSERT INTO secretariats (id, name, code, description, sla_hours)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, data.name, data.code, data.description || null, data.sla_hours)
    .run();

  return c.json({ ok: true, id });
});

secretariats.put('/:id', zValidator('json', updateSecretariatSchema), async (c) => {
  const secretariatId = c.req.param('id');
  const updates = c.req.valid('json');

  const existing = await c.env.DB
    .prepare('SELECT * FROM secretariats WHERE id = ?')
    .bind(secretariatId)
    .first();

  if (!existing) {
    return c.json({ error: 'Secretariat not found' }, 404);
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
    params.push(secretariatId);

    await c.env.DB
      .prepare(`UPDATE secretariats SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
  }

  return c.json({ ok: true });
});

export { secretariats };
