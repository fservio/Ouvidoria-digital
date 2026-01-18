import { Hono } from 'hono';
import type { Env, Variables } from '../types/index.js';
import { logAction } from '../services/audit/logger.js';
import { verifyN8nSignature } from '../services/n8n/crypto.js';

const n8nWebhook = new Hono<{ Bindings: Env; Variables: Variables }>();

n8nWebhook.post('/actions', async (c) => {
  const signature = c.req.header('x-n8n-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const rawBody = await c.req.text();
  const ok = await verifyN8nSignature(rawBody, signature, c.env.N8N_HMAC_SECRET ?? '');
  if (!ok) {
    await logAction(c.env.DB, 'integration', 'n8n', 'invalid_signature', {});
    return c.json({ error: 'Invalid signature' }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const action = payload.action as string | undefined;
  const data = payload.data as Record<string, unknown> | undefined;

  if (!action || !data) {
    return c.json({ error: 'Invalid payload' }, 400);
  }

  const allowlist = await getAllowlist(c.env.DB);
  if (!allowlist.includes(action)) {
    await logAction(c.env.DB, 'integration', 'n8n', 'action_blocked', {}, null, {
      action,
    });
    return c.json({ error: 'Action not allowed' }, 403);
  }

  await applyAction(action, data, c.env);

  await logAction(c.env.DB, 'integration', 'n8n', 'action_applied', {
    userId: 'integration_bot',
  }, null, { action, data });

  return c.json({ ok: true });
});

async function getAllowlist(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare('SELECT config_encrypted FROM integrations WHERE name = ? AND is_active = 1')
    .bind('n8n')
    .first();

  if (!result) return [];

  const config = JSON.parse(String(result.config_encrypted));
  return config.allowed_actions ?? [];
}

async function applyAction(action: string, data: Record<string, unknown>, env: Env) {
  switch (action) {
    case 'request_info':
      if (env.WHATSAPP_QUEUE) {
        await env.WHATSAPP_QUEUE.send({
          type: 'send_message',
          phone: data.phone,
          content: data.message,
          case_id: data.case_id,
        });
      }
      break;

    case 'set_tags':
      await applyTags(data, env.DB);
      break;

    case 'set_priority':
      await env.DB
        .prepare('UPDATE cases SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(data.priority, data.case_id)
        .run();
      break;

    case 'assign_queue':
      await env.DB
        .prepare('UPDATE cases SET queue_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(data.queue_id, 'assigned', data.case_id)
        .run();
      break;

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}

async function applyTags(data: Record<string, unknown>, db: D1Database) {
  const tags = data.tags as string[];
  if (!Array.isArray(tags)) return;

  for (const tagName of tags) {
    const tag = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first();
    if (!tag) continue;

    await db
      .prepare('INSERT OR IGNORE INTO case_tags (case_id, tag_id) VALUES (?, ?)')
      .bind(data.case_id, (tag as { id: string }).id)
      .run();
  }
}

export { n8nWebhook };
