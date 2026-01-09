import type { MiddlewareHandler } from 'hono';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  papel: 'cidadao' | 'secretaria' | 'gestor';
  setor?: string | null;
}

export const authMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const authHeader = c.req.header('authorization');
    if (!authHeader) {
      return c.json({ error: 'Token ausente' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    try {
      const payload = jwt.verify(token, c.env.JWT_SECRET) as AuthUser;
      c.set('user', payload);
      await next();
    } catch (error) {
      return c.json({ error: 'Token inválido' }, 401);
    }
  };
};

export const requireRole = (roles: AuthUser['papel'][]): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user') as AuthUser | undefined;
    if (!user || !roles.includes(user.papel)) {
      return c.json({ error: 'Acesso negado' }, 403);
    }
    await next();
  };
};
