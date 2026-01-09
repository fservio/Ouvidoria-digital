import React, { useState } from 'react'
import AdminLayout from './AdminLayout'
import api from './api'

const Relatorios: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [csv, setCsv] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const gerar = async () => {
    setErro(null)
    try {
      const data = await api.fetchRelatorios(token)
      setCsv(data)
    } catch (e: any) {
      setErro(e.message)
    }
  }

  return (
    <AdminLayout title="Relatórios" onLogout={onLogout}>
      <div className="rounded bg-white p-4 shadow">
        <h3 className="font-semibold mb-3">Relatórios</h3>
        <button className="rounded bg-slate-900 text-white px-3 py-2" onClick={gerar}>Gerar CSV</button>
        {erro && <div className="text-sm text-rose-600 mt-3">{erro}</div>}
        {csv && (
          <pre className="mt-3 rounded border p-3 text-xs bg-slate-50 overflow-auto">{csv}</pre>
        )}
      </div>
    </AdminLayout>
  )
}

export default Relatorios
