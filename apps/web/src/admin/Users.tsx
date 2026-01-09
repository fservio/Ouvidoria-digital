import React, { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import api from './api'
import UserForm from './UserForm'

type User = { id: string; nome: string; email: string; papel: string }

const Users: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [users, setUsers] = useState<User[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [editing, setEditing] = useState<User | null>(null)
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    try {
      const data = await api.fetchUsers(token)
      setUsers(data.results ?? data.users ?? [])
    } catch (e: any) {
      setErro(e.message)
    }
  }

  useEffect(() => { load() }, [token])

  return (
    <AdminLayout title="Usuários" onLogout={onLogout}>
      <div className="rounded bg-white p-4 shadow">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold mb-3">Usuários</h3>
          <button className="rounded bg-slate-900 text-white px-3 py-1" onClick={() => setShowNew(true)}>Novo usuário</button>
        </div>
        {erro && <div className="text-sm text-rose-600">{erro}</div>}
        <div className="grid gap-3">
          {users.map((u) => (
            <div key={u.id} className="p-3 border rounded flex justify-between items-center">
              <div>
                <strong>{u.nome}</strong>
                <div className="text-sm text-slate-500">{u.email}</div>
              </div>
              <div className="flex gap-2">
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
