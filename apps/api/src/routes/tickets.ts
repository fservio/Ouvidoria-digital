import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/authMiddleware'

export const tickets = new Hono()

tickets.use('*', authMiddleware)

const ticketSchema = z.object({
  tipo: z.enum(['educacao', 'saude', 'transito', 'infraestrutura']),
  descricao: z.string().min(10)
})

tickets.post(
  '/',
  zValidator('json', ticketSchema),
  async (c) => {
    const input = c.req.valid('json')
    // inserir ticket no banco
    return c.json({ status: 'ok', ticket: input })
  }
)
