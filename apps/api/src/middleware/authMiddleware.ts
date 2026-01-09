import { verify } from 'hono/jwt'
import type { MiddlewareHandler } from 'hono'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Token ausente' }, 401)

  try {
    const payload = await verify(token, c.env.JWT_SECRET)
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Token inválido' }, 401)
  }
}

export const requireRole = (roles: string[]): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user') as { papel: string }
    if (!roles.includes(user.papel)) {
      return c.json({ error: 'Acesso negado' }, 403)
    }
    await next()
  }
}
