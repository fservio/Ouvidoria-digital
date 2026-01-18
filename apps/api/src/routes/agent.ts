import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/index.js';
import { sendN8nEvent } from '../services/n8n/dispatcher.js';
import { logAction } from '../services/audit/logger.js';
import { applyAgentActions } from '../services/agent.js';

const agent = new Hono<{ Bindings: Env; Variables: Variables }>();

const runSchema = z.object({
  case_id: z.string().min(1),
  message_id: z.string().optional(),
});

agent.use('*', async (c, next) => {
  const user = c.get('user') as { role: string } | null;
  const allowed = ['admin', 'manager', 'GOVERNO_GESTOR_GLOBAL'];
  if (!user || !allowed.includes(user.role)) {
    return c.json({ error: 'Acesso negado' }, 403);
  }
  await next();
});

agent.post('/run', zValidator('json', runSchema), async (c) => {
  const { case_id, message_id } = c.req.valid('json');

  const caseRow = await c.env.DB
    .prepare('SELECT id, protocol, channel, citizen_id FROM cases WHERE id = ?')
    .bind(case_id)
    .first();

  if (!caseRow) {
    return c.json({ error: 'Case not found' }, 404);
  }

  const messageRow = message_id
    ? await c.env.DB.prepare('SELECT id, content, direction FROM messages WHERE id = ?').bind(message_id).first()
    : null;

  const requestPayload = {
    case_id,
    message_id: message_id ?? null,
    channel: (caseRow as { channel?: string }).channel ?? null,
    protocol: (caseRow as { protocol: string }).protocol,
    message: messageRow ? (messageRow as { content: string | null }).content : null,
  };

  const runId = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO agent_runs (id, case_id, message_id, request_json, status)
       VALUES (?, ?, ?, ?, 'pending')`
    )
    .bind(runId, case_id, message_id ?? null, JSON.stringify(requestPayload))
    .run();

  await sendN8nEvent(c.env, {
    event_type: 'agent_run',
    payload: requestPayload,
    created_at: new Date().toISOString(),
  });

  await logAction(c.env.DB, 'agent_run', runId, 'agent.dispatch', {
    userId: (c.get('user') as { id?: string })?.id,
    ip: c.req.header('CF-Connecting-IP') || undefined,
  }, null, { case_id, message_id });

  await logAction(c.env.DB, 'agent_run', runId, 'agent.run', {
    userId: (c.get('user') as { id?: string })?.id,
    ip: c.req.header('CF-Connecting-IP') || undefined,
  }, null, { case_id, message_id });

  return c.json({
    agent_run_id: runId,
    actions_applied: [],
    reply_preview: null,
    auto_sent: false,
    confidence: null,
    risk_level: null,
  });
});

export { agent };
