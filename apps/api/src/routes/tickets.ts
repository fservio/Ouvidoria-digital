import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ticketCreateSchema } from '@/schemas'
import { authMiddleware } from '../middleware/authMiddleware'
import { v4 as uuidv4 } from 'uuid'
import type { Variables } from '../types/hono'

const tickets = new Hono<{ Variables: Variables }>()

tickets.use('*', authMiddleware)

tickets.post(
  '/',
  zValidator('json', ticketCreateSchema),
  async (c) => {
    const { mensagem, setor } = c.req.valid('json')
    const user = c.get('user')

    const id = uuidv4()

    await c.env.DB.prepare(
      `INSERT INTO tickets (id, usuario_id, tipo, descricao) VALUES (?, ?, ?, ?)`
    )
      .bind(id, user.id, setor ?? 'outros', mensagem)
      .run()

    return c.json({ ok: true, id })
  }
)

export default tickets
