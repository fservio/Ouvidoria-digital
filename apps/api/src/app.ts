import { Hono } from 'hono'
import { auth } from './routes/auth.js'
import tickets from './routes/tickets.js'
import notificar from './routes/notificar.js'
import { health } from './routes/health.js'
import relatorios from './routes/relatorios.js'

export interface Env {
  // Add your environment/service bindings here, e.g.:
  // DB?: D1Database
  // KV?: KVNamespace
  // SENTRY_DSN?: string
  [key: string]: unknown
}

const app = new Hono<Env>()

app.route('/auth', auth)
app.route('/tickets', tickets)
app.route('/health', health)
app.route('/relatorios', relatorios)
app.route('/notificar', notificar)

export default app
