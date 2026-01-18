import type { Env } from '../../types/index.js';
import { logAction } from '../audit/logger.js';

export async function scheduleSLA(caseId: string, queueId: string, env: Env) {
  const queue = await env.DB
    .prepare('SELECT sla_hours FROM queues WHERE id = ?')
    .bind(queueId)
    .first();

  const slaHours = queue ? (queue as { sla_hours: number }).sla_hours : 48;
  const slaDue = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  await env.DB
    .prepare('UPDATE cases SET sla_due_at = ? WHERE id = ?')
    .bind(slaDue.toISOString(), caseId)
    .run();

  if (env.SLA_QUEUE) {
    await env.SLA_QUEUE.send({
      case_id: caseId,
      due_at: slaDue.toISOString(),
      queue_id: queueId,
    });
  }
}

export async function markSLABreached(caseId: string, env: Env) {
  await env.DB
    .prepare('UPDATE cases SET sla_breached = 1 WHERE id = ?')
    .bind(caseId)
    .run();

  await logAction(env.DB, 'case', caseId, 'sla_breached', { userId: 'system' });
}
