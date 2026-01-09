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
  }
}

export default api
