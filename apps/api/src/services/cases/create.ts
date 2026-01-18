import type { Env, CasePriority, MetaWebhookMessage, MetaWebhookValue } from '../../types/index.js';
import { generateUniqueProtocol } from '../../utils/protocol.js';
import { routeCase } from '../routing/engine.js';
import { logAction } from '../audit/logger.js';
import { findOrCreateCitizenByWhatsapp, missingFieldsByChannel, mirrorCitizenToCase, normalizePhoneE164 } from '../citizens.js';

export interface CaseCreationResult {
  case_id: string;
  protocol: string;
  queue_id: string | null;
  routed: boolean;
}

export async function createCaseFromMessage(
  message: MetaWebhookMessage,
  webhookValue: MetaWebhookValue,
  env: Env
): Promise<CaseCreationResult> {
  const protocol = await generateUniqueProtocol(env.DB);

  const citizenName = webhookValue.contacts?.[0]?.profile?.name || null;
  const citizenPhone = message.from;
  const firstMessage = message.text?.body || `[${message.type}]`;

  const phoneE164 = normalizePhoneE164(citizenPhone) || `+${citizenPhone}`;
  const citizen = await findOrCreateCitizenByWhatsapp(env, message.from, phoneE164, citizenName);

  const caseId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO cases (id, protocol, external_message_id, citizen_id, citizen_phone, citizen_name, citizen_email, status, source, channel, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 'whatsapp', 'whatsapp', ?)`
  ).bind(
    caseId,
    protocol,
    message.id,
    citizen.id,
    citizen.phone_e164 || phoneE164,
    citizen.full_name || citizenName,
    citizen.email,
    JSON.stringify({
      message_timestamp: message.timestamp,
      phone_number_id: webhookValue.metadata.phone_number_id,
      display_phone_number: webhookValue.metadata.display_phone_number,
    })
  ).run();

  await mirrorCitizenToCase(env, caseId, citizen);

  const missingFields = missingFieldsByChannel('whatsapp', citizen);
  for (const field of missingFields) {
    await env.DB
      .prepare(
        `INSERT OR IGNORE INTO missing_fields (id, case_id, field_name, is_provided)
         VALUES (?, ?, ?, 0)`
      )
      .bind(crypto.randomUUID(), caseId, field)
      .run();
  }

  const routingResult = await routeCase(caseId, firstMessage, env);

  if (routingResult.routed && routingResult.queue_id) {
    await env.DB.prepare(
      'UPDATE cases SET queue_id = ?, status = ? WHERE id = ?'
    ).bind(routingResult.queue_id, 'assigned', caseId).run();

    if (routingResult.sla_hours) {
      const slaDue = new Date(Date.now() + routingResult.sla_hours * 60 * 60 * 1000);
      await env.DB.prepare(
        'UPDATE cases SET sla_due_at = ? WHERE id = ?'
      ).bind(slaDue.toISOString(), caseId).run();

      if (env.SLA_QUEUE) {
        await env.SLA_QUEUE.send({
          case_id: caseId,
          due_at: slaDue.toISOString(),
          queue_id: routingResult.queue_id,
        });
      }
    }
  }

  if (!routingResult.routed && env.N8N_QUEUE) {
    await env.N8N_QUEUE.send({
      event_type: 'inbound_message_received',
      payload: {
        case_id: caseId,
        message: firstMessage,
        phone: citizenPhone,
      },
    });
  }

  await logAction(env.DB, 'case', caseId, 'created', {}, null, {
    protocol,
    citizen_phone: citizenPhone,
    routed: routingResult.routed,
  });

  return {
    case_id: caseId,
    protocol,
    queue_id: routingResult.queue_id,
    routed: routingResult.routed,
  };
}

export async function updateCasePriority(
  caseId: string,
  priority: CasePriority,
  db: D1Database
): Promise<void> {
  await db
    .prepare('UPDATE cases SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(priority, caseId)
    .run();
}

export async function updateCaseStatus(
  caseId: string,
  status: string,
  db: D1Database
): Promise<void> {
  const updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const params: (string | null)[] = [status];

  if (status === 'resolved') {
    updateFields.push('resolved_at = ?');
    params.push(new Date().toISOString());
  } else if (status === 'closed') {
    updateFields.push('closed_at = ?');
    params.push(new Date().toISOString());
  }

  params.push(caseId);

  await db
    .prepare(`UPDATE cases SET ${updateFields.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();
}
