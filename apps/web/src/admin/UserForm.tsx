import React, { useEffect, useState } from 'react'
import api from './api'

const UserForm: React.FC<{ token: string; user?: any; onClose: () => void; onSaved: () => void }> = ({ token, user, onClose, onSaved }) => {
  const [nome, setNome] = useState(user?.nome ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [senha, setSenha] = useState('')
  const [papel, setPapel] = useState(user?.papel ?? 'cidadao')

  useEffect(() => {
    if (user) {
      setNome(user.nome)
      setEmail(user.email)
      setPapel(user.papel)
    }
  }, [user])

  const save = async () => {
    if (user) {
      await api.updateUser(token, user.id, { nome, email, ...(senha ? { senha } : {}), papel })
    } else {
      await api.createUser(token, { nome, email, senha, papel })
    }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white p-4 rounded w-96">
        <h3 className="font-semibold">{user ? 'Editar usuário' : 'Novo usuário'}</h3>
        <div className="mt-3 space-y-2">
          <input className="w-full border rounded px-2 py-1" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
          <input className="w-full border rounded px-2 py-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className="w-full border rounded px-2 py-1" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha (opcional)" />
          <select value={papel} onChange={(e) => setPapel(e.target.value)} className="w-full border rounded px-2 py-1">
            <option value="cidadao">Cidadao</option>
            <option value="secretaria">Secretaria</option>
            <option value="gestor">Gestor</option>
          </select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border">Cancelar</button>
          <button onClick={save} className="px-3 py-1 rounded bg-emerald-600 text-white">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default UserForm
