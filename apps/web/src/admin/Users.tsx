import React, { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import api from './api'

type User = { id: string; nome: string; email: string; papel: string }

const Users: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [users, setUsers] = useState<User[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await api.fetchUsers(token)
        setUsers(data.results ?? data.users ?? [])
      } catch (e: any) {
        setErro(e.message)
      }
    })()
  }, [token])

  return (
    <AdminLayout title="Usuários" onLogout={onLogout}>
      <div className="rounded bg-white p-4 shadow">
        <h3 className="font-semibold mb-3">Usuários</h3>
        {erro && <div className="text-sm text-rose-600">{erro}</div>}
        <div className="grid gap-3">
          {users.map((u) => (
            <div key={u.id} className="p-3 border rounded flex justify-between">
              <div>
                <strong>{u.nome}</strong>
                <div className="text-sm text-slate-500">{u.email}</div>
              </div>
              <div className="text-sm text-slate-600">{u.papel}</div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}

export default Users
