import React, { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { api } from './api'
import UserForm from './UserForm'

type User = { id: string; nome: string; email: string; papel: string; is_active: number; secretariat_id?: string | null }

type FilterState = {
  secretariat_id: string
  role: string
  active: string
  q: string
}

const Users: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [users, setUsers] = useState<User[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [editing, setEditing] = useState<User | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [secretariats, setSecretariats] = useState<Array<{ id: string; name: string }>>([])
  const [filters, setFilters] = useState<FilterState>({ secretariat_id: '', role: '', active: '', q: '' })
  const [secretariatMap, setSecretariatMap] = useState<Record<string, string>>({})

  const load = async () => {
    setErro(null)
    try {
      const params: Record<string, string> = {}
      if (filters.secretariat_id) params.secretariat_id = filters.secretariat_id
      if (filters.role) params.role = filters.role
      if (filters.active) params.active = filters.active
      if (filters.q) params.q = filters.q

      const data = await api.users.list(params)
      setUsers(data.users ?? [])
    } catch (e: any) {
      setErro(e.message)
    }
  }

  const loadSecretariats = async () => {
    try {
      const data = await api.secretariats.list()
      const list = data.secretariats ?? []
      setSecretariats(list)
      setSecretariatMap(Object.fromEntries(list.map((sec: { id: string; name: string }) => [sec.id, sec.name])))
    } catch (e: any) {
      setErro(e.message)
    }
  }

  useEffect(() => {
    load()
    loadSecretariats()
  }, [token])

  useEffect(() => {
    load()
  }, [filters])

  return (
    <AdminLayout title="Usuários" onLogout={onLogout}>
      <div className="rounded bg-white p-4 shadow">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold mb-3">Usuários</h3>
          <button className="rounded bg-slate-900 text-white px-3 py-1" onClick={() => setShowNew(true)}>Novo usuário</button>
        </div>
        {erro && <div className="text-sm text-rose-600">{erro}</div>}
        <div className="grid gap-3 mb-4">
          <div className="grid grid-cols-4 gap-2">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Buscar nome ou email"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <select
              className="border rounded px-2 py-1 text-sm"
              value={filters.secretariat_id}
              onChange={(e) => setFilters({ ...filters, secretariat_id: e.target.value })}
            >
              <option value="">Todas secretarias</option>
              {secretariats.map((sec) => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            >
              <option value="">Todos perfis</option>
              <option value="admin">Admin</option>
              <option value="manager">Gestor</option>
              <option value="operator">Operador</option>
              <option value="viewer">Visualizador</option>
              <option value="GABINETE_VIEWER_GLOBAL">Gabinete (global)</option>
              <option value="GOVERNO_GESTOR_GLOBAL">Governo (global)</option>
            </select>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={filters.active}
              onChange={(e) => setFilters({ ...filters, active: e.target.value })}
            >
              <option value="">Todos status</option>
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3">
          {users.map((u) => (
            <div key={u.id} className="p-3 border rounded flex justify-between items-center">
              <div>
                <strong>{u.nome}</strong>
                <div className="text-sm text-slate-500">{u.email}</div>
                <div className="text-xs text-slate-400">{u.secretariat_id ? (secretariatMap[u.secretariat_id] || u.secretariat_id) : 'Sem secretaria'}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {u.is_active ? 'Ativo' : 'Inativo'}
                </span>
                <div className="text-sm text-slate-600">{u.papel}</div>
                <button onClick={() => setEditing(u)} className="px-2 py-1 rounded bg-indigo-600 text-white text-sm">Editar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {showNew && <UserForm token={token} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />}
      {editing && <UserForm token={token} user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </AdminLayout>
  )
}

export default Users

