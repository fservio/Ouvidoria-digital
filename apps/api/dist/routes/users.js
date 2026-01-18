import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { hashSync } from 'bcryptjs';
import { logAction } from '../services/audit/logger.js';
const ROLE_OPTIONS = ['admin', 'manager', 'operator', 'viewer', 'GABINETE_VIEWER_GLOBAL', 'GOVERNO_GESTOR_GLOBAL'];
export const users = new Hono();
users.use('*', async (c, next) => {
    const user = c.get('user');
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
        return c.json({ error: 'Acesso negado' }, 403);
    }
    await next();
});
const userCreateSchema = z.object({
    nome: z.string().min(1),
    email: z.string().email(),
    senha: z.string().min(6),
    papel: z.enum(ROLE_OPTIONS),
    secretariat_id: z.string().optional(),
});
const userUpdateSchema = z.object({
    nome: z.string().min(1).optional(),
    email: z.string().email().optional(),
    senha: z.string().min(6).optional(),
    papel: z.enum(ROLE_OPTIONS).optional(),
    secretariat_id: z.string().optional(),
    is_active: z.number().int().optional(),
});
const userRolesSchema = z.object({
    roles: z.array(z.enum(ROLE_OPTIONS)).length(1),
});
users.get('/', async (c) => {
    const { secretariat_id, role, active, q } = c.req.query();
    let query = 'SELECT id, name as nome, email, role as papel, secretariat_id, is_active, created_at FROM users WHERE 1=1';
    const params = [];
    if (secretariat_id) {
        query += ' AND secretariat_id = ?';
        params.push(secretariat_id);
    }
    if (role) {
        query += ' AND role = ?';
        params.push(role);
    }
    if (active !== undefined) {
        query += ' AND is_active = ?';
        params.push(active === '1' || active === 'true' ? '1' : '0');
    }
    if (q) {
        query += ' AND (name LIKE ? OR email LIKE ?)';
        const search = `%${q}%`;
        params.push(search, search);
    }
    query += ' ORDER BY name';
    const result = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ users: result.results });
});
users.post('/', zValidator('json', userCreateSchema), async (c) => {
    const data = c.req.valid('json');
    const hashed = hashSync(data.senha, 10);
    const id = `user_${crypto.randomUUID()}`;
    try {
        await c.env.DB
            .prepare(`INSERT INTO users (id, name, email, password_hash, role, secretariat_id)
         VALUES (?, ?, ?, ?, ?, ?)`)
            .bind(id, data.nome, data.email, hashed, data.papel, data.secretariat_id || null)
            .run();
    }
    catch (error) {
        console.error('User create error:', error);
        if (error instanceof Error && error.message.includes('UNIQUE')) {
            return c.json({ error: 'Email já cadastrado' }, 409);
        }
        if (error instanceof Error && error.message.includes('FOREIGN KEY')) {
            return c.json({ error: 'Secretaria inválida' }, 400);
        }
        return c.json({ error: 'Erro ao criar usuário' }, 400);
    }
    await logAction(c.env.DB, 'user', id, 'users.create', {
        userId: c.get('user')?.id,
        ip: c.req.header('CF-Connecting-IP') || undefined,
        userAgent: c.req.header('User-Agent') || undefined,
    }, null, {
        name: data.nome,
        email: data.email,
        role: data.papel,
        secretariat_id: data.secretariat_id || null,
    });
    return c.json({ ok: true, id });
});
users.put('/:id', zValidator('json', userUpdateSchema), async (c) => {
    const userId = c.req.param('id');
    const updates = c.req.valid('json');
    const existing = await c.env.DB
        .prepare('SELECT id, name, email, role, secretariat_id, is_active FROM users WHERE id = ?')
        .bind(userId)
        .first();
    if (!existing) {
        return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    const setClauses = [];
    const params = [];
    if (updates.nome) {
        setClauses.push('name = ?');
        params.push(updates.nome);
    }
    if (updates.email) {
        setClauses.push('email = ?');
        params.push(updates.email);
    }
    if (updates.senha) {
        const hashed = hashSync(updates.senha, 10);
        setClauses.push('password_hash = ?');
        params.push(hashed);
    }
    if (updates.papel) {
        setClauses.push('role = ?');
        params.push(updates.papel);
    }
    if (updates.secretariat_id !== undefined) {
        setClauses.push('secretariat_id = ?');
        params.push(updates.secretariat_id || null);
    }
    if (updates.is_active !== undefined) {
        setClauses.push('is_active = ?');
        params.push(updates.is_active);
    }
    if (setClauses.length > 0) {
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        params.push(userId);
        await c.env.DB
            .prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`)
            .bind(...params)
            .run();
        const oldValues = {
            name: existing.name,
            email: existing.email,
            role: existing.role,
            secretariat_id: existing.secretariat_id,
            is_active: existing.is_active,
        };
        const newValues = {
            name: updates.nome ?? oldValues.name,
            email: updates.email ?? oldValues.email,
            role: updates.papel ?? oldValues.role,
            secretariat_id: updates.secretariat_id !== undefined ? updates.secretariat_id || null : oldValues.secretariat_id,
            is_active: updates.is_active !== undefined ? updates.is_active : oldValues.is_active,
        };
        const context = {
            userId: c.get('user')?.id,
            ip: c.req.header('CF-Connecting-IP') || undefined,
            userAgent: c.req.header('User-Agent') || undefined,
        };
        await logAction(c.env.DB, 'user', userId, 'users.update', context, oldValues, newValues);
        if (updates.is_active !== undefined && updates.is_active !== oldValues.is_active) {
            await logAction(c.env.DB, 'user', userId, updates.is_active ? 'users.enable' : 'users.disable', context, { is_active: oldValues.is_active }, { is_active: updates.is_active });
        }
        if (updates.secretariat_id !== undefined && updates.secretariat_id !== oldValues.secretariat_id) {
            await logAction(c.env.DB, 'user', userId, 'users.secretariat.update', context, { secretariat_id: oldValues.secretariat_id }, { secretariat_id: updates.secretariat_id || null });
        }
    }
    return c.json({ ok: true });
});
users.put('/:id/roles', zValidator('json', userRolesSchema), async (c) => {
    const userId = c.req.param('id');
    const { roles } = c.req.valid('json');
    const existing = await c.env.DB
        .prepare('SELECT id, role FROM users WHERE id = ?')
        .bind(userId)
        .first();
    if (!existing) {
        return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    const newRole = roles[0];
    await c.env.DB
        .prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(newRole, userId)
        .run();
    await logAction(c.env.DB, 'user', userId, 'users.roles.update', {
        userId: c.get('user')?.id,
        ip: c.req.header('CF-Connecting-IP') || undefined,
        userAgent: c.req.header('User-Agent') || undefined,
    }, { role: existing.role }, { role: newRole });
    return c.json({ ok: true });
});
