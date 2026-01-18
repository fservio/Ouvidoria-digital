import { Hono } from 'hono';
import { webhook } from './services/whatsapp/webhook.js';
import { cases } from './routes/cases.js';
import { queues } from './routes/queues.js';
import { secretariats } from './routes/secretariats.js';
import { routingRules } from './routes/routing-rules.js';
import { messages } from './routes/messages.js';
import { audit } from './routes/audit.js';
import { health } from './routes/health.js';
import { publicRoutes } from './routes/public.js';
import { n8nWebhook } from './routes/webhook-n8n.js';
import { integrations } from './routes/integrations.js';
import { templates } from './routes/templates.js';
import { users } from './routes/users.js';
import { citizens } from './routes/citizens.js';
import { caseAudit } from './routes/case-audit.js';
import { auth } from './routes/auth.js';
import { authMiddleware } from './middleware/authMiddleware.js';
const app = new Hono();
app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }
    await next();
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});
app.route('/webhook', webhook);
app.route('/auth', auth);
app.use('/api/v1/*', async (c, next) => {
    if (c.req.path.startsWith('/api/v1/public/')) {
        return next();
    }
    return authMiddleware(c, next);
});
app.route('/api/v1/cases', cases);
app.route('/api/v1/cases', caseAudit);
app.route('/api/v1/messages', messages);
app.route('/api/v1/queues', queues);
app.route('/api/v1/secretariats', secretariats);
app.route('/api/v1/routing-rules', routingRules);
app.route('/api/v1/audit', audit);
app.route('/api/v1/integrations', integrations);
app.route('/api/v1/templates', templates);
app.route('/api/v1/users', users);
app.route('/api/v1/citizens', citizens);
app.route('/webhook-n8n', n8nWebhook);
app.route('/public', publicRoutes);
app.route('/api/v1/public', publicRoutes);
app.route('/health', health);
export default app;
