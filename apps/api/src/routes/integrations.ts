import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/index.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { logAction } from '../services/audit/logger.js';

const integrations = new Hono<{ Bindings: Env; Variables: Variables }>();

const metaUpdateSchema = z.object({
  phone_number_id: z.string().min(1).optional(),
  access_token: z.string().min(1).optional(),
  app_secret: z.string().min(1).optional(),
  test_phone_e164: z.string().min(1).optional(),
  is_enabled: z.boolean().optional(),
  waba_id: z.string().optional(),
  business_account_id: z.string().optional(),
});

integrations.get('/meta', async (c) => {
  const row = await getIntegrationRow(c.env.DB, 'meta');
  if (!row) {
    return c.json({
      phone_number_id: null,
      test_phone_e164: null,
      is_enabled: false,
      last_test_status: null,
      last_test_at: null,
      last_error: null,
      waba_id: null,
      business_account_id: null,
      has_access_token: false,
      has_app_secret: false,
    });
  }

  const config = await getIntegrationConfig(String(row.config_encrypted), c.env.MASTER_KEY);

  return c.json({
    phone_number_id: config.phone_number_id ?? null,
    test_phone_e164: config.test_phone_e164 ?? null,
    is_enabled: config.is_enabled ?? Boolean(row.is_active),
    last_test_status: config.last_test_status ?? null,
    last_test_at: config.last_test_at ?? null,
    last_error: config.last_error ?? null,
    waba_id: config.waba_id ?? null,
    business_account_id: config.business_account_id ?? null,
    has_access_token: Boolean(config.access_token),
    has_app_secret: Boolean(config.app_secret),
  });
});

integrations.put('/meta', zValidator('json', metaUpdateSchema), async (c) => {
  const data = c.req.valid('json');
  const row = await getIntegrationRow(c.env.DB, 'meta');
  const existing = row ? await getIntegrationConfig(String(row.config_encrypted), c.env.MASTER_KEY) : {};

  const updated = {
    ...existing,
    phone_number_id: data.phone_number_id ?? existing.phone_number_id,
    test_phone_e164: data.test_phone_e164 ?? existing.test_phone_e164,
    is_enabled: data.is_enabled ?? existing.is_enabled ?? false,
    waba_id: data.waba_id ?? existing.waba_id,
    business_account_id: data.business_account_id ?? existing.business_account_id,
    access_token: data.access_token?.trim() ? data.access_token : existing.access_token,
    app_secret: data.app_secret?.trim() ? data.app_secret : existing.app_secret,
    last_error: existing.last_error ?? null,
    last_test_status: existing.last_test_status ?? null,
    last_test_at: existing.last_test_at ?? null,
  };

  if (!updated.phone_number_id) {
    return c.json({ error: 'phone_number_id is required' }, 400);
  }

  const encrypted = await encryptSecret(JSON.stringify(updated), c.env.MASTER_KEY);
  const isActive = updated.is_enabled ? 1 : 0;

  await c.env.DB
    .prepare(
      `INSERT INTO integrations (id, name, type, config_encrypted, is_active)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET config_encrypted = excluded.config_encrypted, is_active = excluded.is_active, updated_at = CURRENT_TIMESTAMP`
    )
    .bind('integration_meta', 'meta', 'meta', encrypted, isActive)
    .run();

  await logAction(c.env.DB, 'integration', 'meta', 'updated', {
    userId: c.get('user')?.id,
    ip: c.req.header('CF-Connecting-IP') || undefined,
  });

  return c.json({
    ok: true,
    phone_number_id: updated.phone_number_id,
    test_phone_e164: updated.test_phone_e164 ?? null,
    is_enabled: updated.is_enabled,
    last_test_status: updated.last_test_status ?? null,
    last_test_at: updated.last_test_at ?? null,
    last_error: updated.last_error ?? null,
    waba_id: updated.waba_id ?? null,
    business_account_id: updated.business_account_id ?? null,
    has_access_token: Boolean(updated.access_token),
    has_app_secret: Boolean(updated.app_secret),
  });
});

integrations.post('/meta/test', async (c) => {
  const row = await getIntegrationRow(c.env.DB, 'meta');
  if (!row) {
    return c.json({ error: 'Meta integration not configured' }, 400);
  }

  const config = await getIntegrationConfig(String(row.config_encrypted), c.env.MASTER_KEY);

  if (!config.phone_number_id || !config.access_token || !config.test_phone_e164) {
    return c.json({ error: 'Missing phone_number_id, access_token or test_phone_e164' }, 400);
  }

  const testResult = await sendTestMessage(config.phone_number_id, config.access_token, config.test_phone_e164);

  config.last_test_status = testResult.ok ? 'ok' : 'fail';
  config.last_test_at = new Date().toISOString();
  config.last_error = testResult.ok ? null : testResult.error;

  const encrypted = await encryptSecret(JSON.stringify(config), c.env.MASTER_KEY);

  await c.env.DB
    .prepare(
      `UPDATE integrations SET config_encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?`
    )
    .bind(encrypted, 'meta')
    .run();

  await logAction(c.env.DB, 'integration', 'meta', 'test_connection', {
    userId: c.get('user')?.id,
    ip: c.req.header('CF-Connecting-IP') || undefined,
  }, null, { status: config.last_test_status });

  return c.json({
    ok: testResult.ok,
    last_test_status: config.last_test_status,
    last_test_at: config.last_test_at,
    last_error: config.last_error,
  });
});

async function getIntegrationRow(db: D1Database, name: string) {
  return db.prepare('SELECT * FROM integrations WHERE name = ? LIMIT 1').bind(name).first();
}

async function getIntegrationConfig(encrypted: string, masterKey: string): Promise<Record<string, any>> {
  try {
    const decrypted = await decryptSecret(encrypted, masterKey);
    return JSON.parse(decrypted);
  } catch {
    return JSON.parse(encrypted);
  }
}

async function sendTestMessage(phoneNumberId: string, accessToken: string, to: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: 'Teste de conexao Ouvidoria Digital.' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: errorText };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export { integrations };
