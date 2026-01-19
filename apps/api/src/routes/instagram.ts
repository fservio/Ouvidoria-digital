import { Hono } from 'hono';
import type { Env, Variables } from '../types/index.js';
import { verifyN8nSignature } from '../services/n8n/crypto.js';
import { findOrCreateCitizenByInstagram, missingFieldsByChannel, mirrorCitizenToCase } from '../services/citizens.js';
import { logAction } from '../services/audit/logger.js';
import { sendN8nEvent } from '../services/n8n/dispatcher.js';
import { decryptSecret } from '../utils/crypto.js';

const instagram = new Hono<{ Bindings: Env; Variables: Variables }>();

instagram.post('/inbound', async (c) => {
  const signature = c.req.header('x-n8n-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const rawBody = await c.req.text();
  const config = await getN8nConfig(c.env.DB, c.env.MASTER_KEY);
  const secret = c.env.N8N_HMAC_SECRET || String((config as { hmac_secret?: string } | null)?.hmac_secret ?? '');
  const ok = await verifyN8nSignature(rawBody, signature, secret);

  if (!ok) {
    await logAction(c.env.DB, 'webhook', 'instagram', 'invalid_signature', {});
    return c.json({ error: 'Invalid signature' }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const instagramUserId = String(payload.instagram_user_id || '').trim();
  const instagramUsername = String(payload.instagram_username || '').trim();
  const text = String(payload.text || '').trim();
  const externalMessageId = String(payload.external_message_id || '').trim();

  if (!instagramUserId || !text || !externalMessageId) {
    return c.json({ error: 'Invalid payload' }, 400);
  }

  const existingMessage = await c.env.DB
    .prepare('SELECT id FROM messages WHERE external_message_id = ?')
    .bind(externalMessageId)
    .first();

  if (existingMessage) {
    return c.json({ ok: true, deduped: true });
  }

  const citizen = await findOrCreateCitizenByInstagram(c.env, instagramUserId, instagramUsername);
  const citizenPhone = citizen.phone_e164 || `ig:${instagramUserId}`;

  const caseId = crypto.randomUUID();
  const protocol = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();

  await c.env.DB
    .prepare(
       `INSERT INTO cases (id, protocol, citizen_id, citizen_name, citizen_email, citizen_phone, status, source, channel, metadata)
        VALUES (?, ?, ?, ?, ?, ?, 'new', 'web', 'instagram', ?)`

    )
    .bind(caseId, protocol, citizen.id, citizen.full_name, citizen.email, citizenPhone, JSON.stringify({ source: 'instagram' }))
    .run();

  await mirrorCitizenToCase(c.env, caseId, {
    ...citizen,
    phone_e164: citizenPhone,
  });

  await c.env.DB
    .prepare(
      `INSERT INTO messages (id, case_id, external_message_id, direction, type, content, metadata, is_processed)
       VALUES (?, ?, ?, 'inbound', 'text', ?, ?, 0)`
    )
    .bind(crypto.randomUUID(), caseId, externalMessageId, text, JSON.stringify({ instagram_user_id: instagramUserId, instagram_username: instagramUsername }))
    .run();

  const missingFields = missingFieldsByChannel('instagram', citizen);
  for (const field of missingFields) {
    await c.env.DB
      .prepare(
        `INSERT OR IGNORE INTO missing_fields (id, case_id, field_name, is_provided)
         VALUES (?, ?, ?, 0)`
      )
      .bind(crypto.randomUUID(), caseId, field)
      .run();
  }

  await logAction(c.env.DB, 'case', caseId, 'created', {}, null, { channel: 'instagram', protocol });

  await sendN8nEvent(c.env, {
    event_type: 'agent_run',
    payload: {
      case_id: caseId,
      message_id: externalMessageId,
      channel: 'instagram',
      protocol,
      message: text,
    },
    created_at: new Date().toISOString(),
  });

  return c.json({ ok: true, case_id: caseId, protocol });
});

async function getN8nConfig(db: D1Database, masterKey: string): Promise<Record<string, unknown> | null> {
  const result = await db
    .prepare('SELECT config_encrypted FROM integrations WHERE name = ? AND is_active = 1')
    .bind('n8n')
    .first();

  if (!result) return null;

  const raw = String((result as { config_encrypted: string }).config_encrypted);
  try {
    const decrypted = await decryptSecret(raw, masterKey);
    return JSON.parse(decrypted);
  } catch {
    return JSON.parse(raw);
  }
}

export { instagram };
