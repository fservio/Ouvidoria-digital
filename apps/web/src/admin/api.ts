const API_URL = import.meta.env.VITE_API_URL ?? 'https://ouvidoria-digital.fabioservio.workers.dev';

export interface Case {
  id: string;
  protocol: string;
  citizen_phone: string;
  citizen_name: string | null;
  status: string;
  priority: string;
  queue_name: string | null;
  secretariat_name: string | null;
  created_at: string;
  sla_due_at: string | null;
  sla_breached: number;
}

export interface Message {
  id: string;
  direction: string;
  type: string;
  content: string | null;
  created_at: string;
}

export interface Secretariat {
  id: string;
  code: string;
  name: string;
}

export interface Queue {
  id: string;
  slug: string;
  name: string;
  secretariat_id: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('admin_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  login: (email: string, senha: string) =>
    request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),

  users: {
    list: (filters?: Record<string, string>) => {
      const query = filters ? '?' + new URLSearchParams(filters).toString() : '';
      return request<{ users: Array<{ id: string; nome: string; email: string; papel: string; is_active: number; secretariat_id: string | null }> }>(`/api/v1/users${query}`);
    },
    listBySecretariat: (secretariatId: string) =>
      request<{ users: Array<{ id: string; nome: string }> }>(`/api/v1/users?secretariat_id=${secretariatId}&active=1`),
    create: (payload: { nome: string; email: string; senha: string; papel: string; secretariat_id?: string | null }) =>
      request('/api/v1/users', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<{ nome: string; email: string; senha: string; papel: string; secretariat_id?: string | null; is_active?: number }>) =>
      request(`/api/v1/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    updateRoles: (id: string, roles: string[]) =>
      request(`/api/v1/users/${id}/roles`, { method: 'PUT', body: JSON.stringify({ roles }) }),
  },

  cases: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ cases: Case[]; pagination: { total: number } }>(`/api/v1/cases${query}`);
    },
    get: (id: string) => request<Case & { messages: Message[]; tags: string[]; audit_trail: unknown[]; missing_fields: Array<{ field_name: string }>; secretariat_id?: string | null; queue_id?: string | null; citizen?: { id: string; full_name: string | null; email: string | null; phone_e164: string | null; whatsapp_wa_id: string | null; instagram_user_id: string | null; instagram_username: string | null } | null; agent_run?: { id: string; confidence: number | null; risk_level: string | null; reply_preview: string | null } | null }>(`/api/v1/cases/${id}`),
    update: (id: string, data: Partial<Case> & { queue_id?: string | null; assigned_to?: string | null }) =>
      request(`/api/v1/cases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    sendMessage: (id: string, text: string, isInternal = false) =>
      request(`/api/v1/cases/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text, kind: isInternal ? 'internal' : 'external' }),
      }),
    resendMessage: (messageId: string) =>
      request(`/api/v1/cases/messages/${messageId}/resend`, { method: 'POST' }),
  },

  secretariats: {
    list: () => request<{ secretariats: Secretariat[] }>('/api/v1/secretariats'),
    create: (payload: { name: string; code: string; description?: string; sla_hours?: number }) =>
      request('/api/v1/secretariats', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<{ name: string; description?: string; sla_hours?: number; is_active?: number }>) =>
      request(`/api/v1/secretariats/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  },

  queues: {
    list: (secretariatId?: string) => {
      const params = secretariatId ? `?secretariat_id=${secretariatId}` : '';
      return request<{ queues: Queue[] }>(`/api/v1/queues${params}`);
    },
    create: (payload: { secretariat_id: string; name: string; slug: string; description?: string; priority?: number; sla_hours?: number }) =>
      request('/api/v1/queues', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<{ name: string; description?: string; priority?: number; sla_hours?: number; is_active?: number }>) =>
      request(`/api/v1/queues/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  },

  citizens: {
    update: (id: string, payload: { full_name?: string; email?: string; phone_e164?: string }) =>
      request(`/api/v1/citizens/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  },

  routingRules: {
    list: () => request<{ rules: unknown[] }>('/api/v1/routing-rules'),
    toggle: (id: string) => request(`/api/v1/routing-rules/${id}/toggle`, { method: 'POST' }),
    simulate: (message: string) => request('/api/v1/routing-rules/simulate', { method: 'POST', body: JSON.stringify({ message }) }),
  },

  audit: {
    getCaseTrail: (caseId: string) => request<{ audit_trail: unknown[] }>(`/api/v1/audit/case/${caseId}`),
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ audit_logs: unknown[] }>(`/api/v1/audit${query}`);
    },
    listCase: (caseId: string, params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ logs: unknown[]; next_cursor: string | null }>(`/api/v1/cases/${caseId}/audit${query}`);
    },
  },

  integrations: {
    getMeta: () => request('/api/v1/integrations/meta'),
    updateMeta: (payload: Record<string, unknown>) =>
      request('/api/v1/integrations/meta', { method: 'PUT', body: JSON.stringify(payload) }),
    testMeta: () => request('/api/v1/integrations/meta/test', { method: 'POST' }),
    getN8n: () => request('/api/v1/integrations/n8n'),
    updateN8n: (payload: Record<string, unknown>) =>
      request('/api/v1/integrations/n8n', { method: 'POST', body: JSON.stringify(payload) }),
    testN8n: () => request('/api/v1/integrations/n8n/test', { method: 'POST' }),
  },

  templates: {
    list: () => request<{ templates: unknown[] }>('/api/v1/templates'),
    createVersion: (key: string, content: string) =>
      request(`/api/v1/templates/${key}/version`, { method: 'POST', body: JSON.stringify({ content }) }),
    activate: (key: string, id: string) =>
      request(`/api/v1/templates/${key}/activate`, { method: 'POST', body: JSON.stringify({ id }) }),
  },

  agent: {
    run: (caseId: string, messageId?: string) =>
      request('/api/v1/agent/run', { method: 'POST', body: JSON.stringify({ case_id: caseId, message_id: messageId }) }),
  },
};
