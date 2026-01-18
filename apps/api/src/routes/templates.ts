import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/index.js';
import { logAction } from '../services/audit/logger.js';

const templates = new Hono<{ Bindings: Env; Variables: Variables }>();

const templateCreateSchema = z.object({
  content: z.string().min(1),
  created_by: z.string().optional(),
});

const templateActivateSchema = z.object({
  id: z.string().min(1),
});

templates.get('/', async (c) => {
  const result = await c.env.DB
    .prepare('SELECT * FROM message_templates ORDER BY template_key, version DESC')
    .all();

  return c.json({ templates: result.results });
});

templates.get('/:key', async (c) => {
  const key = c.req.param('key');

  const result = await c.env.DB
    .prepare('SELECT * FROM message_templates WHERE template_key = ? ORDER BY version DESC')
    .bind(key)
    .all();

  return c.json({ templates: result.results });
});

templates.post('/:key/version', zValidator('json', templateCreateSchema), async (c) => {
  const key = c.req.param('key');
  const { content, created_by } = c.req.valid('json');

  const latest = await c.env.DB
    .prepare('SELECT MAX(version) as max_version FROM message_templates WHERE template_key = ?')
    .bind(key)
    .first();

  const nextVersion = ((latest as { max_version: number | null }).max_version ?? 0) + 1;
  const id = `tmpl_${key.toLowerCase()}_v${nextVersion}`;

  await c.env.DB
    .prepare(
      `INSERT INTO message_templates (id, template_key, channel, version, is_active, content, created_by)
       VALUES (?, ?, 'whatsapp', ?, 0, ?, ?)`
    )
    .bind(id, key, nextVersion, content, created_by || c.get('user')?.id || 'system')
    .run();

  await logAction(c.env.DB, 'template', id, 'created', {
    userId: c.get('user')?.id,
    ip: c.req.header('CF-Connecting-IP') || undefined,
  }, null, { template_key: key, version: nextVersion });

  return c.json({ ok: true, id, version: nextVersion });
});

templates.post('/:key/activate', zValidator('json', templateActivateSchema), async (c) => {
  const key = c.req.param('key');
  const { id } = c.req.valid('json');

  await c.env.DB
    .prepare('UPDATE message_templates SET is_active = 0 WHERE template_key = ?')
    .bind(key)
    .run();

  await c.env.DB
    .prepare('UPDATE message_templates SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(id)
    .run();

  await logAction(c.env.DB, 'template', id, 'activated', {
    userId: c.get('user')?.id,
    ip: c.req.header('CF-Connecting-IP') || undefined,
  }, null, { template_key: key });

  return c.json({ ok: true });
});

export { templates };
