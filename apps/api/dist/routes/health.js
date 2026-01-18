import { Hono } from 'hono';
export const health = new Hono();
health.get('/', async (c) => {
    try {
        const dbCheck = await c.env.DB.prepare('SELECT 1 as ok').first();
        return c.json({ status: 'ok', db: Boolean(dbCheck) });
    }
    catch (error) {
        return c.json({ status: 'error', error: error instanceof Error ? error.message : 'unknown' }, 500);
    }
});
