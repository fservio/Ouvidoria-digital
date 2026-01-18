import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/index.js';
import { normalizeEmail, normalizePhoneE164, updateCitizenFields } from '../services/citizens.js';
import { logAction } from '../services/audit/logger.js';

const citizens = new Hono<{ Bindings: Env; Variables: Variables }>();

const updateSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone_e164: z.string().optional(),
});

citizens.use('*', async (c, next) => {
  const user = c.get('user') as { role: string } | null;
  const allowed = ['admin', 'manager', 'GOVERNO_GESTOR_GLOBAL'];
  if (!user || !allowed.includes(user.role)) {
    return c.json({ error: 'Acesso negado' }, 403);
  }
  await next();
});

citizens.put('/:id', zValidator('json', updateSchema), async (c) => {
  const citizenId = c.req.param('id');
  const data = c.req.valid('json');

  const email = data.email ? normalizeEmail(data.email) : undefined;
  if (data.email && !email) {
    return c.json({ error: 'Email inválido' }, 400);
  }

  const phone = data.phone_e164 ? normalizePhoneE164(data.phone_e164) : undefined;
  if (data.phone_e164 && !phone) {
    return c.json({ error: 'Telefone inválido' }, 400);
  }

  const updated = await updateCitizenFields(c.env, citizenId, {
    full_name: data.full_name,
    email,
    phone_e164: phone,
  });

  const fieldsChanged = Object.keys(data);
  await logAction(c.env.DB, 'citizen', citizenId, 'citizen.update', {
    userId: (c.get('user') as { id?: string })?.id,
    ip: c.req.header('CF-Connecting-IP') || undefined,
    userAgent: c.req.header('User-Agent') || undefined,
  }, null, { fields_changed: fieldsChanged });

  return c.json({ citizen: updated });
});

export { citizens };
