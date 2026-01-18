import type { Env } from '../../types/index.js';

const GLOBAL_SECRETARIAT_CODES = ['GABINETE_PREFEITO', 'SECRETARIA_GOVERNO'];

export async function applyCaseVisibilityFilter(
  env: Env,
  baseQuery: string,
  params: string[],
  user: { role: string; secretariat_id?: string | null; id: string }
): Promise<{ query: string; params: string[] }> {
  if (user.role === 'admin' || user.role === 'manager') {
    return { query: baseQuery, params };
  }

  if (user.role === 'GABINETE_VIEWER_GLOBAL' || user.role === 'GOVERNO_GESTOR_GLOBAL') {
    return { query: baseQuery, params };
  }

  if (user.role === 'viewer') {
    return { query: `${baseQuery} AND 1=0`, params };
  }

  if (user.secretariat_id) {
    const globalSecretariat = await isGlobalSecretariat(env, user.secretariat_id);
    if (globalSecretariat) {
      console.warn('[rbac] Deprecated global access via secretariat_code');
      return { query: baseQuery, params };
    }
  }

  if (user.role === 'operator') {
    const queueIds = await getUserQueues(env, user.id);
    if (queueIds.length > 0) {
      const placeholders = queueIds.map(() => '?').join(',');
      return {
        query: `${baseQuery} AND c.queue_id IN (${placeholders})`,
        params: params.concat(queueIds),
      };
    }

    return {
      query: `${baseQuery} AND c.assigned_to = ?`,
      params: params.concat([user.id]),
    };
  }

  return {
    query: `${baseQuery} AND s.id = ?`,
    params: params.concat([user.secretariat_id ?? '']),
  };
}

export async function canAccessCase(
  env: Env,
  user: { role: string; secretariat_id?: string | null; id: string },
  caseRow: { queue_id?: string | null; assigned_to?: string | null; secretariat_id?: string | null }
): Promise<boolean> {
  if (user.role === 'admin' || user.role === 'manager') return true;

  if (user.role === 'GABINETE_VIEWER_GLOBAL' || user.role === 'GOVERNO_GESTOR_GLOBAL') {
    return true;
  }

  if (user.secretariat_id) {
    const globalSecretariat = await isGlobalSecretariat(env, user.secretariat_id);
    if (globalSecretariat) {
      console.warn('[rbac] Deprecated global access via secretariat_code');
      return true;
    }
  }

  if (user.role === 'operator') {
    if (caseRow.assigned_to && caseRow.assigned_to === user.id) return true;
    if (caseRow.queue_id) {
      const queues = await getUserQueues(env, user.id);
      return queues.includes(caseRow.queue_id);
    }
    return false;
  }

  return caseRow.secretariat_id === user.secretariat_id;
}

async function getUserQueues(env: Env, userId: string): Promise<string[]> {
  const result = await env.DB
    .prepare('SELECT queue_id FROM user_queues WHERE user_id = ?')
    .bind(userId)
    .all();

  return (result.results as Array<{ queue_id: string }>).map((row) => row.queue_id);
}

async function isGlobalSecretariat(env: Env, secretariatId: string): Promise<boolean> {
  const result = await env.DB
    .prepare('SELECT code FROM secretariats WHERE id = ?')
    .bind(secretariatId)
    .first();

  if (!result) return false;

  return GLOBAL_SECRETARIAT_CODES.includes((result as { code: string }).code);
}
