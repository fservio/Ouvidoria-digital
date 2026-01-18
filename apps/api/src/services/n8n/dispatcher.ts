import type { Env } from '../../types/index.js';
import { signN8nPayload } from './crypto.js';

export interface N8nEvent {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function sendN8nEvent(env: Env, event: N8nEvent) {
  const config = await getN8nConfig(env.DB);
  if (!config || !config.endpoint_url) {
    return;
  }

  const body = JSON.stringify(event);
  const signature = await signN8nPayload(body, env.N8N_HMAC_SECRET ?? config.hmac_secret ?? '');

  await fetch(config.endpoint_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-n8n-signature': signature,
    },
    body,
  });
}

async function getN8nConfig(db: D1Database): Promise<{ endpoint_url?: string; hmac_secret?: string; allowed_actions?: string[] } | null> {
  const result = await db
    .prepare('SELECT config_encrypted FROM integrations WHERE name = ? AND is_active = 1')
    .bind('n8n')
    .first();

  if (!result) return null;

  return JSON.parse(String(result.config_encrypted));
}
