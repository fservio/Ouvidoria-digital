import { describe, expect, it, beforeEach, vi } from 'vitest';
import app from '../src/app.js';
import bcrypt from 'bcryptjs';

type Row = Record<string, unknown>;

class MemoryDB {
  tickets: Row[] = [];
  users: Row[] = [];
  logAcoes: Row[] = [];

  prepare(sql: string) {
    return {
      bind: (...params: unknown[]) => ({
        run: async () => {
          if (sql.startsWith('INSERT INTO tickets')) {
            const [id, nome, mensagem, setor, status] = params as string[];
            this.tickets.push({ id, nome, mensagem, setor, status, created_at: 'now' });
            return { success: true };
          }
          if (sql.startsWith('INSERT INTO log_acoes')) {
            this.logAcoes.push({ id: params[0], ticket_id: params[1], acao: params[2], detalhe: params[3] });
            return { success: true };
          }
          if (sql.startsWith('UPDATE tickets SET status')) {
            const [status, id] = params as string[];
            const ticket = this.tickets.find((row) => row.id === id);
            if (ticket) ticket.status = status;
            return { success: true };
          }
          if (sql.startsWith('UPDATE tickets SET resposta')) {
            const [resposta, id] = params as string[];
            const ticket = this.tickets.find((row) => row.id === id);
            if (ticket) ticket.resposta = resposta;
            return { success: true };
          }
          return { success: true };
        },
        first: async () => {
          if (sql.startsWith('SELECT id, nome, senha_hash')) {
            const email = params[0];
            return this.users.find((row) => row.email === email) ?? null;
          }
          if (sql.startsWith('SELECT id, setor, status')) {
            const id = params[0];
            return this.tickets.find((row) => row.id === id) ?? null;
          }
          if (sql.startsWith('SELECT mensagem FROM tickets')) {
            const id = params[0];
            const ticket = this.tickets.find((row) => row.id === id);
            return ticket ? { mensagem: ticket.mensagem } : null;
          }
          return null;
        },
        all: async () => {
          if (sql.startsWith('SELECT id, nome, mensagem, setor, status, created_at FROM tickets WHERE setor')) {
            const setor = params[0];
            return { results: this.tickets.filter((row) => row.setor === setor) };
          }
          if (sql.startsWith('SELECT id, nome, mensagem, setor, status, created_at FROM tickets ORDER BY')) {
            return { results: this.tickets };
          }
          return { results: [] };
        }
      })
    };
  }
}

class MemoryKV {
  store = new Map<string, string>();
  async get(key: string) {
    const value = this.store.get(key);
    return value ? JSON.parse(value) : null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

const buildEnv = () => ({
  DB: new MemoryDB(),
  KV: new MemoryKV(),
  JWT_SECRET: 'secret',
  OPENAI_API_KEY: 'openai',
  N8N_SECRET: 'n8n'
});

describe('Ouvidoria API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'saude' } }] }))
    );
  });

  it('creates a ticket with AI classification', async () => {
    const env = buildEnv();
    const res = await app.request(
      '/tickets',
      {
        method: 'POST',
        body: JSON.stringify({ nome: 'Maria', mensagem: 'Preciso de atendimento na UBS.' }),
        headers: { 'Content-Type': 'application/json' }
      },
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.setor).toBe('saude');
  });

  it('authenticates secretaria', async () => {
    const env = buildEnv();
    const senhaHash = await bcrypt.hash('senha123', 8);
    env.DB.users.push({ id: 'user-1', nome: 'Ana', email: 'ana@prefeitura.gov', senha_hash: senhaHash, papel: 'secretaria', setor: 'saude' });

    const res = await app.request(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'ana@prefeitura.gov', senha: 'senha123' }),
        headers: { 'Content-Type': 'application/json' }
      },
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeTruthy();
  });

  it('blocks n8n webhook without token', async () => {
    const env = buildEnv();
    const res = await app.request(
      '/notificar',
      {
        method: 'POST',
        body: JSON.stringify({ ticketId: 't1', mensagem: 'Notificação importante', canal: 'email' }),
        headers: { 'Content-Type': 'application/json' }
      },
      env
    );
    expect(res.status).toBe(401);
  });
});
