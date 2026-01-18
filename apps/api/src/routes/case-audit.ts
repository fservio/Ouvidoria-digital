import { Hono } from 'hono';
import type { Env, Variables } from '../types/index.js';

const caseAudit = new Hono<{ Bindings: Env; Variables: Variables }>();

caseAudit.get('/:id/audit', async (c) => {
  const caseId = c.req.param('id');
  const { limit = '50', cursor } = c.req.query();

  const params: string[] = [caseId];
  let query = 'SELECT a.*, u.name as user_name, u.role as user_role FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id WHERE a.entity_type = ? AND a.entity_id = ?';

  params.unshift('case');

  if (cursor) {
    query += ' AND a.created_at < ?';
    params.push(cursor);
  }

  query += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(limit);

  const result = await c.env.DB.prepare(query).bind(...params).all();

  const logs = (result.results as Array<Record<string, unknown>>).map((log) => ({
    id: log.id,
    created_at: log.created_at,
    action: log.action,
    actor_type: log.user_id ? 'user' : 'system',
    actor_user: log.user_id
      ? { id: log.user_id, name: log.user_name, role: log.user_role }
      : null,
    summary: buildSummary(log.action as string, log.old_value, log.new_value),
    diff: { before: log.old_value, after: log.new_value },
  }));

  const nextCursor = logs.length > 0 ? logs[logs.length - 1].created_at : null;

  return c.json({ logs, next_cursor: nextCursor });
});

function buildSummary(action: string, oldValue: unknown, newValue: unknown): string {
  const before = parseValue(oldValue);
  const after = parseValue(newValue);

  switch (action) {
    case 'cases.assign_user':
      return `Responsável alterado: ${before.assigned_to ?? 'nenhum'} → ${after.assigned_to ?? 'nenhum'}`;
    case 'cases.transfer_queue':
      return `Fila alterada: ${before.queue_id ?? '-'} → ${after.queue_id ?? '-'}`;
    case 'cases.transfer_secretariat':
      return `Secretaria alterada: ${before.secretariat_id ?? '-'} → ${after.secretariat_id ?? '-'}`;
    case 'cases.set_status':
      return `Status: ${before.status ?? '-'} → ${after.status ?? '-'}`;
    case 'cases.set_priority':
      return `Prioridade: ${before.priority ?? '-'} → ${after.priority ?? '-'}`;
    case 'messages.send_external':
      return 'Mensagem enviada ao cidadão';
    case 'messages.add_internal_note':
      return 'Nota interna adicionada';
    case 'messages.resend':
      return 'Mensagem reenviada';
    default:
      return action;
  }
}

function parseValue(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

export { caseAudit };
