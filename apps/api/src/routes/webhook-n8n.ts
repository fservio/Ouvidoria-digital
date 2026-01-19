import { Hono } from 'hono';
import type { Env, Variables } from '../types/index.js';
import { logAction } from '../services/audit/logger.js';
import { verifyN8nSignature } from '../services/n8n/crypto.js';
import { applyAgentActions } from '../services/agent.js';
import { decryptSecret } from '../utils/crypto.js';

const n8nWebhook = new Hono<{ Bindings: Env; Variables: Variables }>();

n8nWebhook.post('/actions', async (c) => {
  const signature = c.req.header('x-n8n-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const rawBody = await c.req.text();
  const config = await getN8nConfig(c.env.DB, c.env.MASTER_KEY);
  const secret = c.env.N8N_HMAC_SECRET || String((config as { hmac_secret?: string } | null)?.hmac_secret ?? '');
  const ok = await verifyN8nSignature(rawBody, signature, secret);
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

  if ((!action || !data) && !Array.isArray(payload.actions)) {
    return c.json({ error: 'Invalid payload' }, 400);
  }

  const allowlist = await getAllowlist(c.env.DB, c.env.MASTER_KEY);
  if (action && !allowlist.includes(action)) {
    await logAction(c.env.DB, 'integration', 'n8n', 'action_blocked', {}, null, {
      action,
    });
    return c.json({ error: 'Action not allowed' }, 403);
  }

  const allowed = (config as { allowed_actions?: string[] } | null)?.allowed_actions;
  const autoSendEnabled = Boolean((config as { auto_send_enabled?: boolean } | null)?.auto_send_enabled);
  const handoffThreshold = Number((config as { handoff_threshold?: number } | null)?.handoff_threshold ?? 0.7);
  const agentEnabled = Boolean((config as { agent_enabled?: boolean } | null)?.agent_enabled);

  if (!agentEnabled) {
    return c.json({ error: 'Agent disabled' }, 403);
  }

  const actions = Array.isArray(payload.actions) ? payload.actions : [payload];
  const applied: string[] = [];
  const confidence = typeof payload.confidence === 'number' ? payload.confidence : null;
  const riskLevel = typeof payload.risk_level === 'string' ? payload.risk_level : null;

  for (const actionItem of actions) {
    const actionType = (actionItem as { type?: string }).type || action;
    if (!actionType) continue;

    if (allowed && allowed.length > 0 && !allowed.includes(actionType)) {
      await logAction(c.env.DB, 'integration', 'n8n', 'action_blocked', {}, null, { action: actionType });
      continue;
    }

    if (!autoSendEnabled && actionType === 'reply_external') {
      await logAction(c.env.DB, 'integration', 'n8n', 'action_blocked', {}, null, { action: actionType });
      continue;
    }

    if (confidence !== null && confidence < handoffThreshold && actionType === 'reply_external') {
      await logAction(c.env.DB, 'integration', 'n8n', 'action_blocked', {}, null, { action: actionType, reason: 'low_confidence' });
      continue;
    }

    const caseId = String((actionItem as Record<string, unknown>).case_id ?? payload.case_id ?? '');
    const messageId = (actionItem as Record<string, unknown>).message_id as string | undefined;
    const channel = (actionItem as Record<string, unknown>).channel as string | undefined;
    const protocol = (actionItem as Record<string, unknown>).protocol as string | undefined;

    const { applied: appliedActions } = await applyAgentActions(c.env, [{ type: actionType, ...actionItem as Record<string, unknown> }], {
      caseId,
      messageId,
      channel: channel ?? null,
      protocol: protocol ?? null,
      allowedActions: allowed,
      autoSendEnabled,
      handoffThreshold,
      confidence,
      riskLevel,
    });

    applied.push(...appliedActions);
  }

  await logAction(c.env.DB, 'integration', 'n8n', 'action_applied', {
    userId: 'integration_bot',
  }, null, { actions_applied: applied });

  return c.json({ ok: true, actions_applied: applied });
});

async function getAllowlist(db: D1Database, masterKey: string): Promise<string[]> {
  const config = await getN8nConfig(db, masterKey);
  if (!config) return [];
  return (config.allowed_actions as string[]) ?? [];
}

async function getN8nConfig(db: D1Database, masterKey: string): Promise<Record<string, unknown> | null> {
  const result = await db
    .prepare('SELECT config_encrypted FROM integrations WHERE name = ? AND is_active = 1')
    .bind('n8n')
    .first();

  if (!result) return null;

  const raw = String((result as { config_encrypted: string }).config_encrypted);
  try {
    const decrypted = await decryptSecret(raw, masterKey);
    return JSON.parse(decrypted);
  } catch {
    return JSON.parse(raw);
  }
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
