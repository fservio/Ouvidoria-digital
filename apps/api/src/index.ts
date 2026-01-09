import { Hono } from 'hono'
import { authMiddleware, requireRole } from './middleware/authMiddleware'
import { handle } from 'hono/cloudflare'

const app = new Hono()

// Rota pública
app.get('/ping', c => c.text('pong'))

// Rota protegida
app.get('/me', authMiddleware, c => {
  const user = c.get('user')
  return c.json({ user })
})

// Rota só para gestores
app.get('/admin', authMiddleware, requireRole(['gestor']), c => {
  return c.text('Área restrita a gestores.')
})

export default handle(app)
