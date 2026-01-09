import { Hono } from 'hono'
import type { Bindings } from '../types/hono.js'

const notificar = new Hono<{ Bindings: Bindings }>()

notificar.post('/', async (c) => {
  const token = c.req.header('x-n8n-secret') || c.req.header('authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Token ausente' }, 401)
  if (String(c.env.N8N_SECRET) !== token) return c.json({ error: 'Token inválido' }, 401)

  // Process payload if needed. For tests we only validate auth.
  return c.json({ ok: true })
})

export default notificar
