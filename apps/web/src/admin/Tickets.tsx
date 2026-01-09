import React, { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import api from './api'
import TicketFilters from './TicketFilters'
import Pagination from './Pagination'
import TicketDetail from './TicketDetail'

type Ticket = { id: string; nome: string; mensagem: string; setor: string; status: string }

const Tickets: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)

  const load = async () => {
    try {
      const data = await api.fetchTicketsPaged(token, page, 10, filters)
      setTickets(data.results ?? data.tickets ?? [])
      setTotalPages(data.totalPages ?? 1)
    } catch (e: any) {
      setErro(e.message)
    }
  }

  useEffect(() => { load() }, [token, page, filters])

  return (
    <AdminLayout title="Tickets" onLogout={onLogout}>
      <div className="rounded bg-white p-4 shadow">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold mb-3">Tickets</h3>
        </div>
        <TicketFilters onChange={(f) => { setFilters(f); setPage(1) }} />
        {erro && <div className="text-sm text-rose-600">{erro}</div>}
        <div className="grid gap-3">
          {tickets.map((t) => (
            <div key={t.id} className="p-3 border rounded cursor-pointer" onClick={() => setSelected(t.id)}>
              <div className="flex justify-between items-center">
                <strong>{t.nome}</strong>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded">{t.status}</span>
              </div>
              <p className="text-sm mt-2">{t.mensagem}</p>
              <p className="text-xs text-slate-500 mt-2">Setor: {t.setor}</p>
            </div>
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} onChange={(p) => setPage(p)} />
      </div>
      {selected && <TicketDetail token={token} id={selected} onClose={() => setSelected(null)} onSaved={() => load()} />}
    </AdminLayout>
  )
}

export default Tickets
