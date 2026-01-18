import { Hono } from 'hono';
import type { Env, Variables } from '../types/index.js';
import { applyCaseVisibilityFilter, canAccessCase } from '../services/auth/rbac.js';

const messages = new Hono<{ Bindings: Env; Variables: Variables }>();

messages.get('/', async (c) => {
  const user = c.get('user') as { role: string; secretariat_id?: string | null; id: string } | null;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { case_id, direction, processed, limit = '50', offset = '0' } = c.req.query();

  let query = 'SELECT m.* FROM messages m JOIN cases c ON m.case_id = c.id LEFT JOIN queues q ON c.queue_id = q.id LEFT JOIN secretariats s ON q.secretariat_id = s.id WHERE 1=1';
  const params: string[] = [];

  if (case_id) {
    query += ' AND m.case_id = ?';
    params.push(case_id);
  }

  if (direction) {
    query += ' AND m.direction = ?';
    params.push(direction);
  }

  if (processed !== undefined) {
    query += ' AND m.is_processed = ?';
    params.push(processed === 'true' ? '1' : '0');
  }

  const filtered = await applyCaseVisibilityFilter(c.env, query, params, user);

  filtered.query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
  filtered.params.push(limit, offset);

  const result = await c.env.DB.prepare(filtered.query).bind(...filtered.params).all();

  return c.json({ messages: result.results });
});

messages.get('/:id', async (c) => {
  const messageId = c.req.param('id');
  const user = c.get('user') as { role: string; secretariat_id?: string | null; id: string } | null;

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await c.env.DB
    .prepare(
      `SELECT m.*, c.queue_id, c.assigned_to, q.secretariat_id
       FROM messages m
       JOIN cases c ON m.case_id = c.id
       LEFT JOIN queues q ON c.queue_id = q.id
       WHERE m.id = ?`
    )
    .bind(messageId)
    .first();

  if (!result) {
    return c.json({ error: 'Message not found' }, 404);
  }

  const allowed = await canAccessCase(c.env, user, result as { queue_id?: string | null; assigned_to?: string | null; secretariat_id?: string | null });
  if (!allowed) {
    return c.json({ error: 'Message not found' }, 404);
  }

  return c.json({ message: result });
});

messages.get('/external/:external_id', async (c) => {
  const externalId = c.req.param('external_id');
  const user = c.get('user') as { role: string; secretariat_id?: string | null; id: string } | null;

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await c.env.DB
    .prepare(
      `SELECT m.*, c.queue_id, c.assigned_to, q.secretariat_id
       FROM messages m
       JOIN cases c ON m.case_id = c.id
       LEFT JOIN queues q ON c.queue_id = q.id
       WHERE m.external_message_id = ?`
    )
    .bind(externalId)
    .first();

  if (!result) {
    return c.json({ error: 'Message not found' }, 404);
  }

  const allowed = await canAccessCase(c.env, user, result as { queue_id?: string | null; assigned_to?: string | null; secretariat_id?: string | null });
  if (!allowed) {
    return c.json({ error: 'Message not found' }, 404);
  }

  return c.json({ message: result });
});

messages.put('/:id/process', async (c) => {
  const messageId = c.req.param('id');

  const existing = await c.env.DB
    .prepare('SELECT * FROM messages WHERE id = ?')
    .bind(messageId)
    .first();

  if (!existing) {
    return c.json({ error: 'Message not found' }, 404);
  }

  await c.env.DB
    .prepare('UPDATE messages SET is_processed = 1, processed_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), messageId)
    .run();

  return c.json({ ok: true });
});

export { messages };
