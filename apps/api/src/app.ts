import { Hono } from 'hono'
import { auth } from './routes/auth'
import tickets from './routes/tickets'
import { health } from './routes/health'
import relatorios from './routes/relatorios'

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

export default app
