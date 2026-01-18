import { Hono } from 'hono';
import type { Env, Variables } from '../types/index.js';
import { getAuditTrail } from '../services/audit/logger.js';

const audit = new Hono<{ Bindings: Env; Variables: Variables }>();

audit.get('/', async (c) => {
  const user = c.get('user') as { role: string } | null;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const allowedRoles = ['admin', 'manager', 'GABINETE_VIEWER_GLOBAL', 'GOVERNO_GESTOR_GLOBAL'];
  if (!allowedRoles.includes(user.role)) {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  const { entity_type, entity_id, user_id, from, to, limit = '100' } = c.req.query();

  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: string[] = [];

  if (entity_type) {
    query += ' AND entity_type = ?';
    params.push(entity_type);
  }

  if (entity_id) {
    query += ' AND entity_id = ?';
    params.push(entity_id);
  }

  if (user_id) {
    query += ' AND user_id = ?';
    params.push(user_id);
  }

  if (from) {
    query += ' AND created_at >= ?';
    params.push(from);
  }

  if (to) {
    query += ' AND created_at <= ?';
    params.push(to);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const result = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ audit_logs: result.results });
});

audit.get('/case/:caseId', async (c) => {
  const caseId = c.req.param('caseId');
  const { limit = '50' } = c.req.query();

  const logs = await getAuditTrail(c.env.DB, 'case', caseId, parseInt(limit));

  return c.json({ audit_trail: logs });
});

audit.get('/user/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { limit = '100' } = c.req.query();

  const result = await c.env.DB
    .prepare(
      `SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .bind(userId, limit)
    .all();

  return c.json({ audit_logs: result.results });
});

audit.get('/security', async (c) => {
  const { limit = '100' } = c.req.query();

  const result = await c.env.DB
    .prepare('SELECT * FROM security_events ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all();

  return c.json({ security_events: result.results });
});

export { audit };
