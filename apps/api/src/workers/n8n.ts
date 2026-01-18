import type { Env } from '../types/index.js';
import { sendN8nEvent } from '../services/n8n/dispatcher.js';

export default {
  async queue(batch: MessageBatch<{ event_type: string; payload: Record<string, unknown> }>, env: Env) {
    for (const msg of batch.messages) {
      try {
        await sendN8nEvent(env, {
          event_type: msg.body.event_type,
          payload: msg.body.payload,
          created_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('n8n dispatch error', error);
      }
    }
  },
};
