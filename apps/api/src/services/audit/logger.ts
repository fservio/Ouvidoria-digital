import type { AuditLog } from '../../types/index.js';

export interface AuditContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export async function logAction(
  db: D1Database,
  entityType: string,
  entityId: string,
  action: string,
  context: AuditContext,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, user_id, old_value, new_value, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        entityType,
        entityId,
        action,
        context.userId || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        context.ip || null,
        context.userAgent || null
      )
      .run();
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

export async function getAuditTrail(
  db: D1Database,
  entityType: string,
  entityId: string,
  limit: number = 100
): Promise<AuditLog[]> {
  const result = await db
    .prepare(
      `SELECT * FROM audit_logs
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(entityType, entityId, limit)
    .all();

  return result.results as unknown as AuditLog[];
}

export async function getCaseAuditTrail(
  db: D1Database,
  caseId: string
): Promise<AuditLog[]> {
  return getAuditTrail(db, 'case', caseId);
}

export async function countActionsByUser(
  db: D1Database,
  userId: string,
  since?: string
): Promise<number> {
  let query = 'SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ?';
  const params: string[] = [userId];

  if (since) {
    query += ' AND created_at >= ?';
    params.push(since);
  }

  const result = await db.prepare(query).bind(...params).first();
  return (result as { count: number }).count;
}

export async function logSecurityEvent(
  db: D1Database,
  type: string,
  details: {
    userId?: string;
    ip?: string;
    path?: string;
    userAgent?: string;
    extra?: unknown;
  }
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO security_events (id, type, user_id, ip, path, user_agent, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        type,
        details.userId || null,
        details.ip || null,
        details.path || null,
        details.userAgent || null,
        details.extra ? JSON.stringify(details.extra) : null
      )
      .run();
  } catch (error) {
    console.error('Security event log error:', error);
  }
}
