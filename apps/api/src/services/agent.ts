import type { Env } from '../types/index.js';
import type { Case } from '../types/index.js';
import { sendOutboundMessage } from './whatsapp/sender.js';
import { logAction } from './audit/logger.js';

export type AgentAction = {
  type: string;
  [key: string]: unknown;
};

export interface AgentApplyOptions {
  caseId: string;
  messageId?: string | null;
  channel: string | null;
  protocol: string | null;
  allowedActions?: string[];
  autoSendEnabled: boolean;
  handoffThreshold: number;
  confidence: number | null;
  riskLevel: string | null;
}

export async function applyAgentActions(env: Env, actions: AgentAction[], options: AgentApplyOptions) {
  const applied: string[] = [];

  const shouldHandoff = options.riskLevel === 'high' || (options.confidence !== null && options.confidence < options.handoffThreshold);
  const expandedActions = [...actions];

  if (shouldHandoff) {
    expandedActions.unshift({ type: 'set_status', status: 'triage_human' });
    expandedActions.unshift({ type: 'suggest_route', secretariat_code: 'OUVIDORIA_CENTRAL', queue_code: 'DENUNCIAS_SENSIVEIS' });
  }

  for (const action of expandedActions) {
    const type = action.type;
    if (!type) continue;

    if (options.allowedActions && options.allowedActions.length > 0 && !options.allowedActions.includes(type)) {
      continue;
    }

    if (!options.autoSendEnabled && type === 'reply_external') {
      continue;
    }

    if (type === 'request_info') {
      await handleRequestInfo(env, action, options);
      applied.push(type);
      continue;
    }

    if (type === 'add_internal_note') {
      await addInternalNote(env, options.caseId, String(action.text ?? ''), options.messageId ?? null);
      applied.push(type);
      continue;
    }

    if (type === 'set_tags') {
      await applyTags(env.DB, options.caseId, Array.isArray(action.tags) ? action.tags : []);
      applied.push(type);
      continue;
    }

    if (type === 'set_priority') {
      if (typeof action.priority === 'string') {
        await env.DB
          .prepare('UPDATE cases SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .bind(action.priority, options.caseId)
          .run();
        applied.push(type);
      }
      continue;
    }

    if (type === 'set_status') {
      if (typeof action.status === 'string') {
        const needsHuman = action.status === 'triage_human' ? 1 : 0;
        await env.DB
          .prepare('UPDATE cases SET status_v2 = ?, needs_human = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .bind(action.status, needsHuman, options.caseId)
          .run();
        applied.push(type);
      }
      continue;
    }

    if (type === 'suggest_route') {
      await applyRouteSuggestion(env, options.caseId, String(action.secretariat_code ?? ''), String(action.queue_code ?? ''));
      applied.push(type);
      continue;
    }

    if (type === 'reply_external') {
      if (typeof action.text === 'string') {
        await sendExternalMessage(env, options.caseId, action.text);
        applied.push(type);
      }
      continue;
    }
  }

  return { applied, needs_human: shouldHandoff };
}

async function handleRequestInfo(env: Env, action: AgentAction, options: AgentApplyOptions) {
  const fields = Array.isArray(action.fields) ? action.fields : [];
  const requiredFieldsList = fields.map((field) => mapFieldLabel(String(field), options.channel)).join('\n');
  const templateKey = options.channel === 'instagram' ? 'IG_REQUEST_INFO' : 'WA_REQUEST_INFO';
  const template = await getActiveTemplate(env.DB, templateKey);
  const fallback = requiredFieldsList
    ? `Preciso das seguintes informacoes:\n${requiredFieldsList}`
    : 'Preciso de mais informacoes para seguir com o atendimento.';

  const content = renderTemplate(template ?? fallback, {
    required_fields_list: requiredFieldsList,
    protocol: options.protocol ?? '',
  });

  await sendExternalMessage(env, options.caseId, content);
}

async function sendExternalMessage(env: Env, caseId: string, content: string) {
  const caseRow = await env.DB.prepare('SELECT * FROM cases WHERE id = ?').bind(caseId).first();
  if (!caseRow) return;

  const caseData = caseRow as unknown as Case;
  const messageId = crypto.randomUUID();

  await env.DB
    .prepare(
      `INSERT INTO messages (id, case_id, direction, type, content, delivery_status, last_error, sent_at, is_processed)
       VALUES (?, ?, 'outbound', 'text', ?, 'pending', NULL, NULL, 0)`
    )
    .bind(messageId, caseId, content)
    .run();

  let deliveryStatus: 'sent' | 'failed' = 'failed';
  let lastError: string | null = null;

  if (caseData.channel === 'whatsapp') {
    const sendResult = await sendOutboundMessage(env, caseData, content);
    deliveryStatus = sendResult.ok ? 'sent' : 'failed';
    lastError = sendResult.error ?? null;
  } else {
    deliveryStatus = 'failed';
    lastError = 'Channel not configured for outbound';
  }

  await env.DB
    .prepare('UPDATE messages SET delivery_status = ?, last_error = ?, sent_at = ? WHERE id = ?')
    .bind(deliveryStatus, lastError, deliveryStatus === 'sent' ? new Date().toISOString() : null, messageId)
    .run();

  await env.DB
    .prepare(
      `INSERT INTO responses (id, case_id, user_id, content, is_internal)
       VALUES (?, ?, ?, ?, 0)`
    )
    .bind(crypto.randomUUID(), caseId, 'system', content)
    .run();

  await logAction(env.DB, 'case', caseId, 'messages.send_external', {
    userId: 'system',
  }, null, { delivery_status: deliveryStatus });
}

async function addInternalNote(env: Env, caseId: string, text: string, messageId?: string | null) {
  if (!text.trim()) return;
  const responseId = crypto.randomUUID();
  const messageRecordId = messageId ?? crypto.randomUUID();

  await env.DB
    .prepare(
      `INSERT INTO messages (id, case_id, direction, type, content, delivery_status, last_error, sent_at, is_processed)
       VALUES (?, ?, 'outbound', 'text', ?, 'sent', NULL, ?, 0)`
    )
    .bind(messageRecordId, caseId, text, new Date().toISOString())
    .run();

  await env.DB
    .prepare(
      `INSERT INTO responses (id, case_id, user_id, content, is_internal)
       VALUES (?, ?, ?, ?, 1)`
    )
    .bind(responseId, caseId, 'system', text)
    .run();

  await logAction(env.DB, 'case', caseId, 'messages.add_internal_note', {
    userId: 'system',
  }, null, { source: 'agent' });
}

async function applyTags(db: D1Database, caseId: string, tags: string[]) {
  for (const tagName of tags) {
    const tag = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first();
    if (!tag) continue;

    await db
      .prepare('INSERT OR IGNORE INTO case_tags (case_id, tag_id) VALUES (?, ?)')
      .bind(caseId, (tag as { id: string }).id)
      .run();
  }
}

async function applyRouteSuggestion(env: Env, caseId: string, secretariatCode: string, queueCode: string) {
  let queueId: string | null = null;

  if (queueCode) {
    const queue = await env.DB
      .prepare('SELECT id FROM queues WHERE slug = ? OR name = ? LIMIT 1')
      .bind(queueCode, queueCode)
      .first();
    if (queue) {
      queueId = (queue as { id: string }).id;
    }
  }

  if (!queueId && secretariatCode) {
    const queue = await env.DB
      .prepare(
        `SELECT q.id FROM queues q
         JOIN secretariats s ON q.secretariat_id = s.id
         WHERE s.code = ? OR s.name = ?
         ORDER BY q.created_at ASC LIMIT 1`
      )
      .bind(secretariatCode, secretariatCode)
      .first();
    if (queue) {
      queueId = (queue as { id: string }).id;
    }
  }

  if (!queueId) {
    const queue = await env.DB.prepare('SELECT id FROM queues WHERE slug = ? LIMIT 1').bind('TRIAGEM').first();
    if (queue) {
      queueId = (queue as { id: string }).id;
    }
  }

  if (queueId) {
    await env.DB
      .prepare('UPDATE cases SET queue_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(queueId, caseId)
      .run();
  }
}

async function getActiveTemplate(db: D1Database, templateKey: string): Promise<string | null> {
  const template = await db
    .prepare('SELECT content FROM message_templates WHERE template_key = ? AND is_active = 1 ORDER BY version DESC LIMIT 1')
    .bind(templateKey)
    .first();
  if (!template) return null;
  return String((template as { content: string }).content);
}

function renderTemplate(template: string, values: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`{{\s*${key}\s*}}`, 'g'), value ?? '');
  }
  return result;
}

function mapFieldLabel(field: string, channel: string | null) {
  switch (field) {
    case 'full_name':
      return 'Nome completo';
    case 'email':
      return 'E-mail';
    case 'phone_e164':
      return channel === 'instagram'
        ? 'Telefone no formato +55DDXXXXXXXXX (ex.: +5586999999999)'
        : 'Telefone';
    default:
      return field;
  }
}
