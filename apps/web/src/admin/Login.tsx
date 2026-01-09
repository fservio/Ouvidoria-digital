import React, { useState } from 'react'
import api from './api'

const Login: React.FC<{ onLogin: (token: string) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const submit = async () => {
    setErro(null)
    try {
      const data = await api.login(email, senha)
      onLogin(data.token)
      localStorage.setItem('admin_token', data.token)
      window.location.href = '/admin/tickets'
    } catch (e: any) {
      setErro(e.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold mb-4">Entrar no CMS</h2>
        <input className="w-full rounded border px-3 py-2 mb-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="w-full rounded border px-3 py-2 mb-3" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <button className="w-full rounded bg-indigo-600 px-3 py-2 text-white" onClick={submit}>Entrar</button>
        {erro && <div className="mt-3 text-sm text-rose-600">{erro}</div>}
      </div>
    </div>
  )
}

export default Login
