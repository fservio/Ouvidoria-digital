import { Hono } from 'hono';
import type { Env, Variables, MetaWebhookPayload } from '../../types/index.js';
import { verifyMetaSignature } from './crypto.js';
import { createCaseFromMessage } from '../cases/create.js';
import { logAction } from '../audit/logger.js';

const webhook = new Hono<{ Bindings: Env; Variables: Variables }>();

webhook.get('/webhook', async (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  const verifyToken = c.env.WEBHOOK_VERIFY_TOKEN || 'ouvidoria_verify_token';

  if (mode === 'subscribe' && token === verifyToken) {
    return c.text(challenge || 'OK', 200);
  }

  return c.json({ error: 'Verification failed' }, 403);
});

webhook.post('/webhook', async (c) => {
  const signature = c.req.header('x-hub-signature-256');
  const rawBody = await c.req.text();

  if (!signature) {
    await logAction(c.env.DB, 'webhook', 'meta', 'missing_signature', {
      ip: c.req.header('CF-Connecting-IP') || 'unknown',
    });
    return c.json({ error: 'Signature missing' }, 401);
  }

  let appSecret: string;
  try {
    appSecret = await getMetaAppSecret(c.env.DB);
  } catch {
    return c.json({ error: 'Meta integration not configured' }, 500);
  }

  const signatureOk = await verifyMetaSignature(rawBody, signature, appSecret);
  if (!signatureOk) {
    await logAction(c.env.DB, 'webhook', 'meta', 'invalid_signature', {
      ip: c.req.header('CF-Connecting-IP') || 'unknown',
    });
    return c.json({ error: 'Invalid signature' }, 403);
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  if (payload.object !== 'whatsapp_business_accounts') {
    return c.json({ status: 'ignored' }, 200);
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field === 'messages') {
        await processMessages(change.value, c.env);
      }
    }
  }

  return c.json({ status: 'ok' }, 200);
});

async function processMessages(value: MetaWebhookPayload['entry'][0]['changes'][0]['value'], env: Env) {

  if (!value.messages) return;

  for (const message of value.messages) {
    const existingMessage = await env.DB
      .prepare('SELECT id FROM messages WHERE external_message_id = ?')
      .bind(message.id)
      .first();

    if (existingMessage) {
      continue;
    }

    try {
      const caseResult = await createCaseFromMessage(message, value, env);

      await env.DB
        .prepare(
          `INSERT INTO messages (id, case_id, external_message_id, direction, type, content, metadata, is_processed)
           VALUES (?, ?, ?, 'inbound', ?, ?, ?, 0)`
        )
        .bind(
          crypto.randomUUID(),
          caseResult.case_id,
          message.id,
          message.type,
          message.text?.body || null,
          JSON.stringify(message)
        )
        .run();

      if (env.MESSAGE_QUEUE) {
        await env.MESSAGE_QUEUE.send({
          type: 'process_message',
          message_id: message.id,
          case_id: caseResult.case_id,
          timestamp: message.timestamp,
        });
      }

      if (env.N8N_QUEUE) {
        await env.N8N_QUEUE.send({
          event_type: 'inbound_message_received',
          payload: {
            case_id: caseResult.case_id,
            message: message.text?.body || '',
            phone: message.from,
          },
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      await logAction(env.DB, 'webhook', 'meta', 'processing_error', {}, null, {
        message_id: message.id,
        error: String(error),
      });
    }
  }
}


async function getMetaAppSecret(db: D1Database): Promise<string> {
  const result = await db
    .prepare('SELECT config_encrypted FROM integrations WHERE name = ? AND is_active = 1')
    .bind('meta')
    .first();

  if (!result) throw new Error('Meta integration not configured');

  const config = JSON.parse(String(result.config_encrypted));
  return config.app_secret;
}

export { webhook };
