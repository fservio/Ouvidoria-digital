import React, { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import api from './api'

type Ticket = { id: string; nome: string; mensagem: string; setor: string; status: string }

const Tickets: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await api.fetchTickets(token)
        setTickets(data.results ?? data.tickets ?? [])
      } catch (e: any) {
        setErro(e.message)
      }
    })()
  }, [token])

  return (
    <AdminLayout title="Tickets" onLogout={onLogout}>
      <div className="rounded bg-white p-4 shadow">
        <h3 className="font-semibold mb-3">Tickets</h3>
        {erro && <div className="text-sm text-rose-600">{erro}</div>}
        <div className="grid gap-3">
          {tickets.map((t) => (
            <div key={t.id} className="p-3 border rounded">
              <div className="flex justify-between items-center">
                <strong>{t.nome}</strong>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded">{t.status}</span>
              </div>
              <p className="text-sm mt-2">{t.mensagem}</p>
              <p className="text-xs text-slate-500 mt-2">Setor: {t.setor}</p>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}

export default Tickets
