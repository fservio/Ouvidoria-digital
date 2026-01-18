import type { Env } from '../types/index.js';
import { markSLABreached } from '../services/sla/engine.js';

export default {
  async queue(batch: MessageBatch<{ case_id: string; due_at: string }>, env: Env) {
    for (const msg of batch.messages) {
      try {
        const dueAt = new Date(msg.body.due_at);
        if (Date.now() >= dueAt.getTime()) {
          await markSLABreached(msg.body.case_id, env);
        }
      } catch (error) {
        console.error('SLA processing error', error);
      }
    }
  },
};
