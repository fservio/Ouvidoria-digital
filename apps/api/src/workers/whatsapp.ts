import type { Env } from '../types/index.js';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response('WhatsApp Worker', { status: 200 });
  },

  async queue(batch: MessageBatch<{ type: string; [key: string]: unknown }>, env: Env) {
    for (const msg of batch.messages) {
      try {
        switch (msg.body.type) {
          case 'process_message':
            await processIncomingMessage(msg.body as unknown as { message_id: string; case_id: string }, env);
            break;

          case 'send_message':
            await sendWhatsAppMessage(
              msg.body as unknown as { phone: string; content: string; case_id: string },
              env
            );
            break;

          default:
            console.warn(`Unknown message type: ${msg.body.type}`);
        }
      } catch (error) {
        console.error(`Queue processing error:`, error);
      }
    }
  }
};

async function processIncomingMessage(data: { message_id: string; case_id: string }, env: Env) {
  const message = await env.DB
    .prepare('SELECT * FROM messages WHERE external_message_id = ?')
    .bind(data.message_id)
    .first();

  if (!message) return;

  const caseData = await env.DB
    .prepare('SELECT * FROM cases WHERE id = ?')
    .bind(data.case_id)
    .first();

  if (!caseData) return;

  if ((caseData as { status: string }).status === 'new') {
    await env.DB
      .prepare('UPDATE cases SET status = ? WHERE id = ?')
      .bind('routing', data.case_id)
      .run();
  }

  await env.DB
    .prepare('UPDATE messages SET is_processed = 1, processed_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), (message as { id: string }).id)
    .run();
}

async function sendWhatsAppMessage(data: { phone: string; content: string; case_id: string }, env: Env) {
  const integration = await env.DB
    .prepare('SELECT config_encrypted FROM integrations WHERE name = ? AND is_active = 1')
    .bind('meta')
    .first();

  if (!integration) {
    console.error('Meta integration not configured');
    return;
  }

  const config = JSON.parse((integration as { config_encrypted: string }).config_encrypted);

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
        to: data.phone,
        type: 'text',
        text: { body: data.content },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`WhatsApp API error: ${error}`);
    return;
  }

  const result = (await response.json()) as { messages?: Array<{ id: string }> };

  if (result.messages?.[0]?.id) {
    await env.DB
      .prepare('UPDATE messages SET external_message_id = ? WHERE case_id = ? AND direction = ? AND content = ?')
      .bind(result.messages[0].id, data.case_id, 'outbound', data.content)
      .run();
  }
}
