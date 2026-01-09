import type { MiddlewareHandler } from 'hono';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;

export const rateLimit = (): MiddlewareHandler => {
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
    const key = `rate:${ip}`;
    const now = Math.floor(Date.now() / 1000);
    const current = await c.env.KV.get(key, { type: 'json' }) as { count: number; reset: number } | null;
    if (!current || current.reset < now) {
      await c.env.KV.put(key, JSON.stringify({ count: 1, reset: now + WINDOW_SECONDS }), {
        expirationTtl: WINDOW_SECONDS
      });
      await next();
      return;
    }

    if (current.count >= MAX_REQUESTS) {
      return c.json({ error: 'Rate limit excedido' }, 429);
    }

    await c.env.KV.put(key, JSON.stringify({ count: current.count + 1, reset: current.reset }), {
      expirationTtl: current.reset - now
    });
    await next();
  };
};
