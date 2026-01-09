import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ticketCreateSchema } from '../schemas/ticket.js';
import { v4 as uuidv4 } from 'uuid';
import { classifyTicket } from '../services/openai.js';
const tickets = new Hono();
tickets.post('/', zValidator('json', ticketCreateSchema), async (c) => {
    const { nome, mensagem, setor } = c.req.valid('json');
    const id = uuidv4();
    const classifiedSetor = setor ?? (await classifyTicket(String(c.env.OPENAI_API_KEY), mensagem));
    await c.env.DB.prepare(`INSERT INTO tickets (id, nome, mensagem, setor, status) VALUES (?, ?, ?, ?, ?)`)
        .bind(id, nome, mensagem, classifiedSetor, 'novo')
        .run();
    return c.json({ ok: true, id, setor: classifiedSetor });
});
export default tickets;
