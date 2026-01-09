import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js'
import type { Variables, Bindings } from '../types/hono.js'

const relatorios = new Hono<{ Bindings: Bindings; Variables: Variables }>()

relatorios.use('*', authMiddleware, requireRole(['gestor']))

relatorios.get('/csv', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM tickets ORDER BY criada_em DESC`
  ).all()

  const csv = [
    Object.keys(results[0] || {}).join(','),
    ...results.map((row: any) => Object.values(row).join(',')), // 👈 Alternativa rápida
  ].join('\n')

  return c.text(csv, 200, { 'Content-Type': 'text/csv' })
})

export default relatorios
