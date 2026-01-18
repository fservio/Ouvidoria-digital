import { Hono } from 'hono';
import type { Env, Variables } from '../types/index.js';
import { logSecurityEvent, logAction } from '../services/audit/logger.js';
import { findOrCreateCitizenByPhoneEmail, missingFieldsByChannel, mirrorCitizenToCase, normalizeEmail, normalizePhoneE164 } from '../services/citizens.js';

const publicRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

publicRoutes.post('/cases', async (c) => {
  try {
    if (c.env.PUBLIC_INTAKE_ENABLED === 'false') {
      return c.json({ error: 'Intake desativado' }, 403);
    }

    const body = await c.req.json();
    const nome = String(body.full_name || '').trim();
    const mensagem = String(body.description || '').trim();
    const emailRaw = String(body.email || '').trim();
    const phoneRaw = String(body.phone_e164 || '').trim();
    const consent = body.consent === true;

    const email = normalizeEmail(emailRaw);
    const phone = normalizePhoneE164(phoneRaw);

    if (!nome || !mensagem || !email || !phone) {
      return c.json({ error: 'Dados inválidos' }, 400);
    }

    if (!consent) {
      return c.json({ error: 'Consentimento obrigatório' }, 400);
    }

    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const hour = new Date().toISOString().slice(0, 13);
    const rateKey = `rl:public_cases:${ip}:${hour}`;
    const recent = await c.env.KV.get(rateKey);
    if (recent) {
      const count = parseInt(recent);
      if (count >= 10) {
        await logSecurityEvent(c.env.DB, 'rate_limit_exceeded', {
          ip,
          path: '/api/v1/public/cases',
          extra: { count },
        });
        return c.json({ error: 'Too many requests' }, 429);
      }
      await c.env.KV.put(rateKey, String(count + 1), { expirationTtl: 60 * 60 });
    } else {
      await c.env.KV.put(rateKey, '1', { expirationTtl: 60 * 60 });
    }

    const consentAt = new Date().toISOString();
    const { citizen } = await findOrCreateCitizenByPhoneEmail(
      c.env,
      phone,
      email,
      nome,
      'web_form',
      consentAt
    );

    const protocol = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    const caseId = crypto.randomUUID();

    await c.env.DB
      .prepare(
        `INSERT INTO cases (id, protocol, citizen_id, citizen_name, citizen_email, citizen_phone, status, source, channel, metadata)
         VALUES (?, ?, ?, ?, ?, ?, 'new', 'web', 'web', ?)`
      )
      .bind(caseId, protocol, citizen.id, citizen.full_name, citizen.email, citizen.phone_e164, JSON.stringify({ message: mensagem }))
      .run();

    await mirrorCitizenToCase(c.env, caseId, citizen);

    const missingFields = missingFieldsByChannel('web', citizen);
    for (const field of missingFields) {
      await c.env.DB
        .prepare(
          `INSERT OR IGNORE INTO missing_fields (id, case_id, field_name, is_provided)
           VALUES (?, ?, ?, 0)`
        )
        .bind(crypto.randomUUID(), caseId, field)
        .run();
    }

    await c.env.DB
      .prepare(
        `INSERT INTO messages (id, case_id, external_message_id, direction, type, content, metadata, is_processed)
         VALUES (?, ?, ?, 'inbound', 'text', ?, ?, 0)`
      )
      .bind(crypto.randomUUID(), caseId, `web_${crypto.randomUUID()}`, mensagem, JSON.stringify({ channel: 'web' }))
      .run();

    await logAction(c.env.DB, 'case', caseId, 'created', {}, null, {
      channel: 'web',
      protocol,
    });

    return c.json({ protocol, case_id: caseId, status: 'open' });
  } catch (error) {
    console.error('Public case create error:', error);
    return c.json({ error: 'Erro interno' }, 500);
  }
});

publicRoutes.get('/cases/:protocol', async (c) => {
  const protocol = c.req.param('protocol');

  const result = await c.env.DB
    .prepare(
      `SELECT c.protocol, c.status, c.priority, c.created_at, c.sla_due_at, c.sla_breached,
              q.name as queue_name, s.name as secretariat_name
       FROM cases c
       LEFT JOIN queues q ON c.queue_id = q.id
       LEFT JOIN secretariats s ON q.secretariat_id = s.id
       WHERE c.protocol = ?`
    )
    .bind(protocol)
    .first();

  if (!result) {
    return c.json({ error: 'Protocolo não encontrado' }, 404);
  }

  const caseData = result as Record<string, unknown>;

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';

  const recentQueries = await c.env.KV.get(`rate_limit:protocol:${ip}`);
  if (recentQueries) {
    const queries = parseInt(recentQueries);
    if (queries >= 30) {
      await logSecurityEvent(c.env.DB, 'rate_limit_exceeded', {
        ip,
        path: `/public/cases/${protocol}`,
        extra: { queries },
      });

      return c.json({ error: 'Too many requests' }, 429);
    }
    await c.env.KV.put(`rate_limit:protocol:${ip}`, String(queries + 1), { expirationTtl: 60 });
  } else {
    await c.env.KV.put(`rate_limit:protocol:${ip}`, '1', { expirationTtl: 60 });
  }

  return c.json({
    protocolo: caseData.protocol,
    status: caseData.status,
    prioridade: caseData.priority,
    criado_em: caseData.created_at,
    prazo_sla: caseData.sla_due_at,
    sla_estourado: caseData.sla_breached === 1,
    fila: caseData.queue_name,
    secretaria: caseData.secretariat_name,
  });
});

export { publicRoutes };
