import { Hono } from 'hono'
import { authMiddleware, requireRole } from './middleware/authMiddleware'
import type { Variables } from './types/hono'

// App Hono principal
const app = new Hono<{ Variables: Variables }>()

// Rota publica
app.get('/ping', (c) => c.text('pong'))

// Rota raiz
app.get('/', (c) => c.text('ouvidoria digital api'))

// Rota protegida
app.get('/me', authMiddleware, (c) => {
  const user = c.get('user') // user setado pelo middleware
  return c.json({ user })
})

// Rota somente para gestores
app.get(
  '/admin',
  authMiddleware,
  requireRole(['gestor']),
  (c) => c.text('Area restrita a gestores.')
)

export default app
