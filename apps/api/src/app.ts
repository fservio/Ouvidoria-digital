import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
import { authMiddleware, requireRole, type AuthUser } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import {
  authLoginSchema,
  ticketCreateSchema,
  ticketStatusUpdateSchema,
  n8nNotifySchema,
  n8nActionSchema
} from './schemas.js';
import { classifyTicket, generateResponse } from './services/openai.js';
import { toCsv } from './utils/csv.js';

interface Env {
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    JWT_SECRET: string;
    OPENAI_API_KEY: string;
    N8N_SECRET: string;
  };
  Variables: {
    user?: AuthUser;
  };
}

const app = new Hono<Env>();

app.use('*', rateLimit());

app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/auth/login', zValidator('json', authLoginSchema), async (c) => {
  const { email, senha } = c.req.valid('json');
  const user = await c.env.DB.prepare('SELECT id, nome, senha_hash, papel, setor, email FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (!user) {
    return c.json({ error: 'Credenciais inválidas' }, 401);
  }

  const valid = await bcrypt.compare(senha, String(user.senha_hash));
  if (!valid) {
    return c.json({ error: 'Credenciais inválidas' }, 401);
  }

  const payload: AuthUser = {
    id: String(user.id),
    papel: user.papel as AuthUser['papel'],
    setor: user.setor ? String(user.setor) : null,
    email: String(user.email)
  };

  const expiresInSeconds = 8 * 60 * 60;
  const token = await sign(
    { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds },
    c.env.JWT_SECRET
  );
  return c.json({ token, user: payload });
});

app.post('/tickets', zValidator('json', ticketCreateSchema), async (c) => {
  const { nome, mensagem, setor } = c.req.valid('json');
  const authHeader = c.req.header('authorization');
  if (authHeader && authHeader !== `Bearer ${c.env.N8N_SECRET}`) {
    return c.json({ error: 'Token n8n inválido' }, 401);
  }

  const finalSetor = setor ?? (await classifyTicket(c.env.OPENAI_API_KEY, mensagem));
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO tickets (id, nome, mensagem, setor, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
  )
    .bind(id, nome, mensagem, finalSetor, 'novo')
    .run();

  await c.env.DB.prepare(
    'INSERT INTO log_acoes (id, ticket_id, acao, detalhe, criado_em) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
  )
    .bind(crypto.randomUUID(), id, 'criado', `Ticket criado pelo cidadão ${nome}`)
    .run();

  return c.json({ protocolo: id, setor: finalSetor, status: 'novo' });
});

app.get('/tickets/:id', async (c) => {
  const id = c.req.param('id');
  const ticket = await c.env.DB.prepare(
    'SELECT id, setor, status, resposta, created_at FROM tickets WHERE id = ?'
  )
    .bind(id)
    .first();

  if (!ticket) {
    return c.json({ error: 'Ticket não encontrado' }, 404);
  }

  return c.json(ticket);
});

app.post('/notificar', zValidator('json', n8nNotifySchema), async (c) => {
  const authHeader = c.req.header('authorization');
  if (authHeader !== `Bearer ${c.env.N8N_SECRET}`) {
    return c.json({ error: 'Token n8n inválido' }, 401);
  }

  const { ticketId, mensagem, canal } = c.req.valid('json');
  await c.env.DB.prepare(
    'INSERT INTO log_acoes (id, ticket_id, acao, detalhe, criado_em) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
  )
    .bind(crypto.randomUUID(), ticketId, 'notificacao', `${canal}: ${mensagem}`)
    .run();

  return c.json({ status: 'ok' });
});

app.post('/webhook/acao', zValidator('json', n8nActionSchema), async (c) => {
  const authHeader = c.req.header('authorization');
  if (authHeader !== `Bearer ${c.env.N8N_SECRET}`) {
    return c.json({ error: 'Token n8n inválido' }, 401);
  }

  const { ticketId, acao, detalhe } = c.req.valid('json');
  await c.env.DB.prepare(
    'INSERT INTO log_acoes (id, ticket_id, acao, detalhe, criado_em) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
  )
    .bind(crypto.randomUUID(), ticketId, acao, detalhe ?? null)
    .run();

  return c.json({ status: 'registrado' });
});

app.get('/secretaria/tickets', authMiddleware(), requireRole(['secretaria']), async (c) => {
  const user = c.get('user') as AuthUser;
  const rows = await c.env.DB.prepare(
    'SELECT id, nome, mensagem, setor, status, created_at FROM tickets WHERE setor = ? ORDER BY created_at DESC'
  )
    .bind(user.setor ?? '')
    .all();

  return c.json({ tickets: rows.results ?? [] });
});

app.patch(
  '/tickets/:id/status',
  authMiddleware(),
  requireRole(['secretaria', 'gestor']),
  zValidator('json', ticketStatusUpdateSchema),
  async (c) => {
    const { status } = c.req.valid('json');
    const id = c.req.param('id');

    await c.env.DB.prepare(
      'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(status, id)
      .run();

    await c.env.DB.prepare(
      'INSERT INTO log_acoes (id, ticket_id, user_id, acao, detalhe, criado_em) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    )
      .bind(crypto.randomUUID(), id, (c.get('user') as AuthUser).id, 'status', status)
      .run();

    return c.json({ status });
  }
);

app.post('/tickets/:id/resposta', authMiddleware(), requireRole(['secretaria']), async (c) => {
  const id = c.req.param('id');
  const ticket = await c.env.DB.prepare('SELECT mensagem FROM tickets WHERE id = ?').bind(id).first();
  if (!ticket) {
    return c.json({ error: 'Ticket não encontrado' }, 404);
  }

  const resposta = await generateResponse(c.env.OPENAI_API_KEY, String(ticket.mensagem));
  await c.env.DB.prepare(
    'UPDATE tickets SET resposta = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(resposta, id)
    .run();

  await c.env.DB.prepare(
    'INSERT INTO log_acoes (id, ticket_id, user_id, acao, detalhe, criado_em) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
  )
    .bind(crypto.randomUUID(), id, (c.get('user') as AuthUser).id, 'resposta_gerada', null)
    .run();

  return c.json({ resposta });
});

app.get('/gestor/tickets', authMiddleware(), requireRole(['gestor']), async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT id, nome, mensagem, setor, status, created_at FROM tickets ORDER BY created_at DESC'
  ).all();
  return c.json({ tickets: rows.results ?? [] });
});

app.get('/gestor/export', authMiddleware(), requireRole(['gestor']), async (c) => {
  const format = c.req.query('format') ?? 'json';
  const rows = await c.env.DB.prepare(
    'SELECT id, nome, mensagem, setor, status, created_at FROM tickets ORDER BY created_at DESC'
  ).all();
  const results = rows.results ?? [];

  if (format === 'csv') {
    const csv = toCsv(results as Record<string, unknown>[]);
    c.header('Content-Type', 'text/csv');
    return c.text(csv);
  }

  return c.json({ tickets: results });
});

export default app;
