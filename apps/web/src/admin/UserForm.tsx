import React, { useEffect, useState } from 'react'
import { api } from './api'

type RoleOption = 'admin' | 'manager' | 'operator' | 'viewer' | 'GABINETE_VIEWER_GLOBAL' | 'GOVERNO_GESTOR_GLOBAL'

const UserForm: React.FC<{ token: string; user?: any; onClose: () => void; onSaved: () => void }> = ({ token, user, onClose, onSaved }) => {
  const [nome, setNome] = useState(user?.nome ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [senha, setSenha] = useState('')
  const [papel, setPapel] = useState<RoleOption>(user?.papel ?? 'operator')
  const [secretariatId, setSecretariatId] = useState<string>(user?.secretariat_id ?? '')
  const [isActive, setIsActive] = useState<number>(user?.is_active ?? 1)
  const [secretariats, setSecretariats] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (user) {
      setNome(user.nome)
      setEmail(user.email)
      setPapel(user.papel)
      setSecretariatId(user.secretariat_id ?? '')
      setIsActive(user.is_active ?? 1)
    }
  }, [user])

  useEffect(() => {
    const loadSecretariats = async () => {
      const data = await api.secretariats.list()
      setSecretariats(data.secretariats ?? [])
    }
    loadSecretariats()
  }, [token])

  const save = async () => {
    if (user) {
      await api.users.update(user.id, {
        nome,
        email,
        ...(senha ? { senha } : {}),
        secretariat_id: secretariatId || null,
        is_active: isActive,
      })
      if (papel && papel !== user.papel) {
        await api.users.updateRoles(user.id, [papel])
      }
    } else {
      await api.users.create({ nome, email, senha, papel, secretariat_id: secretariatId || null })
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
          <select value={secretariatId} onChange={(e) => setSecretariatId(e.target.value)} className="w-full border rounded px-2 py-1">
            <option value="">Sem secretaria</option>
            {secretariats.map((sec) => (
              <option key={sec.id} value={sec.id}>{sec.name}</option>
            ))}
          </select>
          <select value={papel} onChange={(e) => setPapel(e.target.value as RoleOption)} className="w-full border rounded px-2 py-1">
            <option value="admin">Admin</option>
            <option value="manager">Gestor</option>
            <option value="operator">Operador</option>
            <option value="viewer">Visualizador</option>
            <option value="GABINETE_VIEWER_GLOBAL">Gabinete (global)</option>
            <option value="GOVERNO_GESTOR_GLOBAL">Governo (global)</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive === 1} onChange={(e) => setIsActive(e.target.checked ? 1 : 0)} />
            Usuário ativo
          </label>
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

