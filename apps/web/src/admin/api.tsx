const API_URL = import.meta.env.VITE_API_URL ?? ''

export const api = {
  login: async (email: string, senha: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    })
    if (!res.ok) throw new Error('Credenciais inválidas')
    return res.json()
  },
  fetchTickets: async (token: string) => {
    const res = await fetch(`${API_URL}/tickets`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Falha ao carregar tickets')
    return res.json()
  },
  fetchUsers: async (token: string) => {
    const res = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Falha ao carregar usuários')
    return res.json()
  },
  fetchRelatorios: async (token: string) => {
    const res = await fetch(`${API_URL}/relatorios/csv`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Falha ao gerar relatório')
    return res.text()
  },

  // Extended CRUD
  fetchTicketsPaged: async (token: string, page = 1, size = 10, filters: Record<string, string> = {}) => {
    const params = new URLSearchParams({ page: String(page), size: String(size), ...filters })
    const res = await fetch(`${API_URL}/tickets?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Falha ao carregar tickets')
    return res.json()
  },

  fetchTicket: async (token: string, id: string) => {
    const res = await fetch(`${API_URL}/tickets/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Falha ao carregar ticket')
    return res.json()
  },

  updateTicket: async (token: string, id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/tickets/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error('Falha ao atualizar ticket')
    return res.json()
  },

  createUser: async (token: string, body: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error('Falha ao criar usuário')
    return res.json()
  },

  updateUser: async (token: string, id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error('Falha ao atualizar usuário')
    return res.json()
  },

  deleteUser: async (token: string, id: string) => {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Falha ao excluir usuário')
    return res.json()
  }
}

export default api

