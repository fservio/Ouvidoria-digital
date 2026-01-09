import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
export const users = new Hono();
const userSchema = z.object({
    nome: z.string(),
    email: z.string().email(),
    senha: z.string().min(6),
    papel: z.enum(['cidadao', 'gestor'])
});
users.post('/', zValidator('json', userSchema), async (c) => {
    const data = c.req.valid('json');
    // salvar no banco com c.env.DB
    return c.json({ success: true, data });
});
