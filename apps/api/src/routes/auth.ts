import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { z } from 'zod'
import { compareSync } from 'bcryptjs'
import type { Env } from '../types/index.js'
import { logSecurityEvent } from '../services/audit/logger.js'

export const auth = new Hono<{ Bindings: Env }>()

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6)
})

auth.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Payload inválido' }, 400)

    const { email, senha } = parsed.data

    const result = await c.env.DB.prepare(
      'SELECT id, name, email, password_hash, role, secretariat_id, is_active FROM users WHERE email = ? LIMIT 1'
    ).bind(email).first()

    if (!result) return c.json({ error: 'Usuário não encontrado' }, 404)

    if ((result as { is_active: number }).is_active === 0) {
      console.warn('[auth] Attempted login for inactive user', email)
      await logSecurityEvent(c.env.DB, 'auth.login_inactive', {
        userId: (result as { id: string }).id,
        ip: c.req.header('CF-Connecting-IP') || undefined,
        path: c.req.path,
        userAgent: c.req.header('User-Agent') || undefined,
      })
      return c.json({ error: 'Usuário desativado' }, 403)
    }

    const valid = compareSync(senha, String((result as { password_hash: string }).password_hash))
    if (!valid) return c.json({ error: 'Senha incorreta' }, 401)

    const payload = {
      id: (result as { id: string }).id,
      email: (result as { email: string }).email,
      role: (result as { role: string }).role,
      secretariat_id: (result as { secretariat_id: string | null }).secretariat_id
    }

    const token = await sign(payload, c.env.JWT_SECRET)

    return c.json({ token })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Erro interno' }, 500)
  }
})
