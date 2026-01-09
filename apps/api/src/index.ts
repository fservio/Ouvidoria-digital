import { Hono } from 'hono'
import { authMiddleware, requireRole } from './middleware/authMiddleware'
import type { Variables } from './types/hono'

// ÐY'Î AQUI ESTÇ? A CORREÇÎÇŸO
const app = new Hono<{ Variables: Variables }>()

// Rota pÇ§blica
app.get('/ping', (c) => c.text('pong'))

// Rota raiz
app.get('/', (c) => c.text('ouvidoria digital api'))

// Rota protegida
app.get('/me', authMiddleware, (c) => {
  const user = c.get('user') // ƒo. agora funciona
  return c.json({ user })
})

// Rota sÇü para gestores
app.get(
  '/admin',
  authMiddleware,
  requireRole(['gestor']),
  (c) => c.text('Ç?rea restrita a gestores.')
)

export default app
