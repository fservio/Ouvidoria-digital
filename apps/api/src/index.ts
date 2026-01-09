import { Hono } from 'hono'
import { authMiddleware, requireRole } from './middleware/authMiddleware'
import type { Variables } from './types/hono'

// 👇 AQUI ESTÁ A CORREÇÃO
const app = new Hono<{ Variables: Variables }>()

// Rota pública
app.get('/ping', (c) => c.text('pong'))

// Rota protegida
app.get('/me', authMiddleware, (c) => {
  const user = c.get('user') // ✅ agora funciona
  return c.json({ user })
})

// Rota só para gestores
app.get(
  '/admin',
  authMiddleware,
  requireRole(['gestor']),
  (c) => c.text('Área restrita a gestores.')
)

export default app
