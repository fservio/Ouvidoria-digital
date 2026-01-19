import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, Variables, Case } from '../types/index.js';
import { logAction, getAuditTrail } from '../services/audit/logger.js';
import { applyCaseVisibilityFilter, canAccessCase } from '../services/auth/rbac.js';
import { sendOutboundMessage } from '../services/whatsapp/sender.js';

const cases = new Hono<{ Bindings: Env; Variables: Variables }>();

const updateCaseSchema = z.object({
  status: z.enum(['new', 'routing', 'assigned', 'in_progress', 'waiting_citizen', 'resolved', 'closed', 'triage_human']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  queue_id: z.string().optional(),
  assigned_to: z.string().nullable().optional(),
});


cases.get('/', async (c) => {
  const user = c.get('user') as { role: string; secretariat_id?: string | null; id: string } | null;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const {
    status,
    priority,
    queue_id,
    secretariat_id,
    from,
    to,
    search,
    page = '1',
    limit = '20',
  } = c.req.query();

  let query = `
    SELECT c.*, q.name as queue_name, s.name as secretariat_name, s.code as secretariat_code
    FROM cases c
    LEFT JOIN queues q ON c.queue_id = q.id
    LEFT JOIN secretariats s ON q.secretariat_id = s.id
    WHERE 1=1
  `;

  const params: string[] = [];

  if (status) {
    query += ' AND c.status = ?';
    params.push(status);
  }

  if (priority) {
    query += ' AND c.priority = ?';
    params.push(priority);
  }

  if (queue_id) {
    query += ' AND c.queue_id = ?';
    params.push(queue_id);
  }

  if (secretariat_id) {
    query += ' AND s.id = ?';
    params.push(secretariat_id);
  }

  if (from) {
    query += ' AND c.created_at >= ?';
    params.push(from);
  }

  if (to) {
    query += ' AND c.created_at <= ?';
    params.push(to);
  }

  if (search) {
    query += ' AND (c.protocol LIKE ? OR c.citizen_phone LIKE ? OR c.citizen_name LIKE ?)';
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const filtered = await applyCaseVisibilityFilter(c.env, query, params, user);

  const countQuery = filtered.query.replace(
    'SELECT c.*, q.name as queue_name, s.name as secretariat_name, s.code as secretariat_code',
    'SELECT COUNT(*) as count'
  );
  const totalResult = await c.env.DB.prepare(countQuery).bind(...filtered.params).first();
  const total = (totalResult as { count: number }).count;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const pagedQuery = `${filtered.query} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
  const pagedParams = filtered.params.concat([limit, String(offset)]);

  const result = await c.env.DB.prepare(pagedQuery).bind(...pagedParams).all();

  return c.json({
    cases: result.results,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

cases.get('/:id', async (c) => {
  const caseId = c.req.param('id');

  const user = c.get('user') as { role: string; secretariat_id?: string | null; id: string } | null;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const caseResult = await c.env.DB
    .prepare(
      `SELECT c.*, q.name as queue_name, s.name as secretariat_name, s.code as secretariat_code, s.id as secretariat_id,
              cp.id as citizen_id, cp.full_name as citizen_full_name, cp.email as citizen_email,
              cp.phone_e164 as citizen_phone_e164, cp.whatsapp_wa_id as citizen_whatsapp_wa_id,
              cp.instagram_user_id as citizen_instagram_user_id, cp.instagram_username as citizen_instagram_username
       FROM cases c
       LEFT JOIN queues q ON c.queue_id = q.id
       LEFT JOIN secretariats s ON q.secretariat_id = s.id
       LEFT JOIN citizen_profiles cp ON c.citizen_id = cp.id
       WHERE c.id = ?`
    )
    .bind(caseId)
    .first();

  if (!caseResult) {
    return c.json({ error: 'Case not found' }, 404);
  }

  const allowed = await canAccessCase(c.env, user, caseResult as { queue_id?: string | null; assigned_to?: string | null; secretariat_id?: string | null });
  if (!allowed) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const messagesResult = await c.env.DB
    .prepare('SELECT * FROM messages WHERE case_id = ? ORDER BY created_at ASC')
    .bind(caseId)
    .all();

  const tagsResult = await c.env.DB
    .prepare(
      `SELECT t.id, t.name, t.color FROM tags t JOIN case_tags ct ON t.id = ct.tag_id WHERE ct.case_id = ?`
    )
    .bind(caseId)
    .all();

  const missingFieldsResult = await c.env.DB
    .prepare('SELECT * FROM missing_fields WHERE case_id = ? AND is_provided = 0')
    .bind(caseId)
    .all();

  const auditTrail = await getAuditTrail(c.env.DB, 'case', caseId);

  const citizen = caseResult && (caseResult as Record<string, unknown>).citizen_id ? {
    id: (caseResult as { citizen_id: string }).citizen_id,
    full_name: (caseResult as { citizen_full_name: string | null }).citizen_full_name,
    email: (caseResult as { citizen_email: string | null }).citizen_email,
    phone_e164: (caseResult as { citizen_phone_e164: string | null }).citizen_phone_e164,
    whatsapp_wa_id: (caseResult as { citizen_whatsapp_wa_id: string | null }).citizen_whatsapp_wa_id,
    instagram_user_id: (caseResult as { citizen_instagram_user_id: string | null }).citizen_instagram_user_id,
    instagram_username: (caseResult as { citizen_instagram_username: string | null }).citizen_instagram_username,
  } : null;

  const agentRun = await c.env.DB
    .prepare('SELECT id, confidence, risk_level, response_json FROM agent_runs WHERE case_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(caseId)
    .first();

  const parsedAgent = agentRun ? {
    id: (agentRun as { id: string }).id,
    confidence: (agentRun as { confidence: number | null }).confidence ?? null,
    risk_level: (agentRun as { risk_level: string | null }).risk_level ?? null,
    reply_preview: (() => {
      try {
        const responseJson = JSON.parse(String((agentRun as { response_json: string | null }).response_json ?? 'null')) as { actions?: Array<{ type?: string; text?: string }> } | null;
        const reply = responseJson?.actions?.find((action) => action.type === 'reply_external');
        return reply?.text ?? null;
      } catch {
        return null;
      }
    })(),
  } : null;

  return c.json({
    ...caseResult,
    citizen,
    agent_run: parsedAgent,
    messages: messagesResult.results,
    tags: tagsResult.results,
    missing_fields: missingFieldsResult.results,
    audit_trail: auditTrail,
  });
});

cases.put('/:id', zValidator('json', updateCaseSchema), async (c) => {
  const caseId = c.req.param('id');
  const user = c.get('user') as { role: string; secretariat_id?: string | null; id: string } | null;
  const updates = c.req.valid('json');

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const existing = await c.env.DB
    .prepare('SELECT c.*, q.secretariat_id FROM cases c LEFT JOIN queues q ON c.queue_id = q.id WHERE c.id = ?')
    .bind(caseId)
    .first();

  if (!existing) {
    return c.json({ error: 'Case not found' }, 404);
  }

  const allowed = await canAccessCase(c.env, user, existing as { queue_id?: string | null; assigned_to?: string | null; secretariat_id?: string | null });
  if (!allowed) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const setClauses: string[] = [];
  const params: (string | null)[] = [];

  const oldStatus = (existing as { status?: string }).status;
  const oldPriority = (existing as { priority?: string }).priority;
  const oldQueue = (existing as { queue_id?: string | null }).queue_id;
  const oldAssigned = (existing as { assigned_to?: string | null }).assigned_to;
  const oldSecretariat = (existing as { secretariat_id?: string | null }).secretariat_id;

  if (updates.status) {
    setClauses.push('status = ?');
    params.push(updates.status);

    if (updates.status === 'resolved') {
      setClauses.push('resolved_at = ?');
      params.push(new Date().toISOString());
    } else if (updates.status === 'closed') {
      setClauses.push('closed_at = ?');
      params.push(new Date().toISOString());
    }
  }

  if (updates.priority) {
    setClauses.push('priority = ?');
    params.push(updates.priority);
  }

  if (updates.queue_id) {
    setClauses.push('queue_id = ?');
    params.push(updates.queue_id);
  }

  if (updates.assigned_to !== undefined) {
    setClauses.push('assigned_to = ?');
    params.push(updates.assigned_to);
  }

  if (setClauses.length > 0) {
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(caseId);

    await c.env.DB
      .prepare(`UPDATE cases SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    if (updates.status && updates.status !== oldStatus) {
      await logAction(c.env.DB, 'case', caseId, 'cases.set_status', {
        userId: user.id,
        ip: c.req.header('CF-Connecting-IP') || undefined,
      }, { status: oldStatus }, { status: updates.status });
    }

    if (updates.priority && updates.priority !== oldPriority) {
      await logAction(c.env.DB, 'case', caseId, 'cases.set_priority', {
        userId: user.id,
        ip: c.req.header('CF-Connecting-IP') || undefined,
      }, { priority: oldPriority }, { priority: updates.priority });
    }

    if (updates.queue_id && updates.queue_id !== oldQueue) {
      await logAction(c.env.DB, 'case', caseId, 'cases.transfer_queue', {
        userId: user.id,
        ip: c.req.header('CF-Connecting-IP') || undefined,
      }, { queue_id: oldQueue }, { queue_id: updates.queue_id });
    }

    if (updates.assigned_to !== undefined && updates.assigned_to !== oldAssigned) {
      await logAction(c.env.DB, 'case', caseId, 'cases.assign_user', {
        userId: user.id,
        ip: c.req.header('CF-Connecting-IP') || undefined,
      }, { assigned_to: oldAssigned }, { assigned_to: updates.assigned_to });
    }

    if (oldSecretariat && updates.queue_id && updates.queue_id !== oldQueue) {
      const newSecretariat = await c.env.DB
        .prepare('SELECT secretariat_id FROM queues WHERE id = ?')
        .bind(updates.queue_id)
        .first();

      const newSecretariatId = (newSecretariat as { secretariat_id?: string | null })?.secretariat_id;
      if (newSecretariatId && newSecretariatId !== oldSecretariat) {
        await logAction(c.env.DB, 'case', caseId, 'cases.transfer_secretariat', {
          userId: user.id,
          ip: c.req.header('CF-Connecting-IP') || undefined,
        }, { secretariat_id: oldSecretariat }, { secretariat_id: newSecretariatId });
      }
    }
  }

  return c.json({ ok: true });
});

cases.get('/:id/messages', async (c) => {
  const caseId = c.req.param('id');
  const user = c.get('user') as { role: string; secretariat_id?: string | null; id: string } | null;

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const caseData = await c.env.DB
    .prepare('SELECT c.*, q.secretariat_id FROM cases c LEFT JOIN queues q ON c.queue_id = q.id WHERE c.id = ?')
    .bind(caseId)
    .first();

  if (!caseData) {
    return c.json({ error: 'Case not found' }, 404);
  }

  const allowed = await canAccessCase(c.env, user, caseData as { queue_id?: string | null; assigned_to?: string | null; secretariat_id?: string | null });
  if (!allowed) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const messagesResult = await c.env.DB
    .prepare(
      `SELECT m.*, r.id as response_id, r.content as response_content, r.is_internal, u.name as user_name
       FROM messages m
       LEFT JOIN responses r ON m.case_id = r.case_id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE m.case_id = ?
       ORDER BY m.created_at ASC`
    )
    .bind(caseId)
    .all();

  return c.json({ messages: messagesResult.results });
});

cases.post('/:id/messages', zValidator('json', z.object({
  text: z.string().min(1),
  kind: z.enum(['external', 'internal']).default('external'),
})), async (c) => {
  const caseId = c.req.param('id');
  const user = c.get('user') as { id: string } | null;
  const { text, kind } = c.req.valid('json');

  const caseData = await c.env.DB
    .prepare('SELECT *, COALESCE(status_v2, status) AS status_effective FROM cases WHERE id = ?')
    .bind(caseId)
    .first();

  if (!caseData) {
    return c.json({ error: 'Case not found' }, 404);
  }

  const allowed = await canAccessCase(c.env, c.get('user') as { role: string; secretariat_id?: string | null; id: string }, caseData as { queue_id?: string | null; assigned_to?: string | null; secretariat_id?: string | null });
  if (!allowed) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const messageId = crypto.randomUUID();
  const isInternal = kind === 'internal';

  await c.env.DB
    .prepare(
      `INSERT INTO messages (id, case_id, direction, type, content, delivery_status, last_error, sent_at, is_processed)
       VALUES (?, ?, 'outbound', 'text', ?, 'pending', NULL, NULL, 0)`
    )
    .bind(messageId, caseId, text)
    .run();

  let deliveryStatus: 'sent' | 'failed' = 'failed';
  let lastError: string | null = null;

  if (isInternal) {
    deliveryStatus = 'sent';
    await c.env.DB
      .prepare('UPDATE messages SET delivery_status = ?, sent_at = ? WHERE id = ?')
      .bind(deliveryStatus, new Date().toISOString(), messageId)
      .run();
  } else {
    const sendResult = await sendOutboundMessage(c.env, caseData as unknown as Case, text);
    deliveryStatus = sendResult.ok ? 'sent' : 'failed';
    lastError = sendResult.error ?? null;

    await c.env.DB
      .prepare('UPDATE messages SET delivery_status = ?, last_error = ?, sent_at = ? WHERE id = ?')
      .bind(deliveryStatus, lastError, sendResult.ok ? new Date().toISOString() : null, messageId)
      .run();
  }

  await c.env.DB
    .prepare(
      `INSERT INTO responses (id, case_id, user_id, content, is_internal)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), caseId, user?.id || 'system', text, isInternal ? 1 : 0)
    .run();

  await logAction(c.env.DB, 'case', caseId, isInternal ? 'messages.add_internal_note' : 'messages.send_external', {
    userId: user?.id,
    ip: c.req.header('CF-Connecting-IP') || undefined,
  }, null, { text, kind, delivery_status: deliveryStatus });

  return c.json({ ok: true, message_id: messageId, delivery_status: deliveryStatus, last_error: lastError });
});

cases.post('/messages/:id/resend', async (c) => {
  const messageId = c.req.param('id');
  const user = c.get('user') as { role: string; secretariat_id?: string | null; id: string } | null;

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const message = await c.env.DB
    .prepare('SELECT * FROM messages WHERE id = ?')
    .bind(messageId)
    .first();

  if (!message) {
    return c.json({ error: 'Message not found' }, 404);
  }

  if ((message as { delivery_status: string }).delivery_status !== 'failed') {
    return c.json({ error: 'Only failed messages can be resent' }, 400);
  }

  const caseData = await c.env.DB
    .prepare('SELECT c.*, q.secretariat_id FROM cases c LEFT JOIN queues q ON c.queue_id = q.id WHERE c.id = ?')
    .bind((message as { case_id: string }).case_id)
    .first();

  if (!caseData) {
    return c.json({ error: 'Case not found' }, 404);
  }

  const allowed = await canAccessCase(c.env, user, caseData as { queue_id?: string | null; assigned_to?: string | null; secretariat_id?: string | null });
  if (!allowed) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const sendResult = await sendOutboundMessage(c.env, caseData as unknown as Case, (message as { content: string }).content);

  await c.env.DB
    .prepare('UPDATE messages SET delivery_status = ?, last_error = ?, sent_at = ? WHERE id = ?')
    .bind(sendResult.ok ? 'sent' : 'failed', sendResult.error ?? null, sendResult.ok ? new Date().toISOString() : null, messageId)
    .run();

  await logAction(c.env.DB, 'message', messageId, 'messages.resend', {
    userId: user.id,
    ip: c.req.header('CF-Connecting-IP') || undefined,
  }, null, { delivery_status: sendResult.ok ? 'sent' : 'failed' });

  return c.json({ ok: sendResult.ok, delivery_status: sendResult.ok ? 'sent' : 'failed', last_error: sendResult.error ?? null });
});

cases.get('/protocol/:protocol', async (c) => {
  const protocol = c.req.param('protocol');

  const caseResult = await c.env.DB
    .prepare(
      `SELECT c.protocol, c.status, c.priority, c.created_at, c.sla_due_at,
              q.name as queue_name, s.name as secretariat_name
       FROM cases c
       LEFT JOIN queues q ON c.queue_id = q.id
       LEFT JOIN secretariats s ON q.secretariat_id = s.id
       WHERE c.protocol = ?`
    )
    .bind(protocol)
    .first();

  if (!caseResult) {
    return c.json({ error: 'Protocol not found' }, 404);
  }

  return c.json({
    protocol: (caseResult as { protocol: string }).protocol,
    status: (caseResult as { status: string }).status,
    priority: (caseResult as { priority: string }).priority,
    created_at: (caseResult as { created_at: string }).created_at,
    sla_due_at: (caseResult as { sla_due_at: string | null }).sla_due_at,
    queue_name: (caseResult as { queue_name: string | null }).queue_name,
    secretariat_name: (caseResult as { secretariat_name: string | null }).secretariat_name,
  });
});

export { cases };
