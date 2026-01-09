import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { z } from 'zod';
import { compareSync } from 'bcryptjs';
export const auth = new Hono();
// Schema para login
const loginSchema = z.object({
    email: z.string().email(),
    senha: z.string().min(6)
});
auth.post('/login', async (c) => {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success)
        return c.json({ error: 'Payload inválido' }, 400);
    const { email, senha } = parsed.data;
    const result = await c.env.DB.prepare('SELECT id, nome, senha_hash FROM users WHERE email = ? LIMIT 1').bind(email).first();
    if (!result)
        return c.json({ error: 'Usuário não encontrado' }, 404);
    const valid = compareSync(senha, String(result.senha_hash));
    if (!valid)
        return c.json({ error: 'Senha incorreta' }, 401);
    const token = await sign({
        id: result.id,
        email: result.email,
        papel: result.papel,
        setor: result.setor
    }, c.env.JWT_SECRET);
    return c.json({ token });
});
