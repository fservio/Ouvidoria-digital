import type { Env, Case } from '../../types/index.js';

export async function sendOutboundMessage(
  env: Env,
  caseData: Case,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const integration = await env.DB
    .prepare('SELECT config_encrypted FROM integrations WHERE name = ? AND is_active = 1')
    .bind('meta')
    .first();

  if (!integration) {
    return { ok: false, error: 'Meta integration not configured' };
  }

  const config = JSON.parse(String((integration as { config_encrypted: string }).config_encrypted));
  if (!config.phone_number_id || !config.access_token) {
    return { ok: false, error: 'Meta integration missing credentials' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: caseData.citizen_phone,
          type: 'text',
          text: { body: content },
        }),
        signal: controller.signal,
      }
    );

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
