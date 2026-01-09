import React, { useEffect, useState } from 'react'
import api from './api'

const TicketDetail: React.FC<{ token: string; id: string | null; onClose: () => void; onSaved: () => void }> = ({ token, id, onClose, onSaved }) => {
  const [ticket, setTicket] = useState<any | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const data = await api.fetchTicket(token, id)
      setTicket(data)
      setStatus(data.status ?? '')
    })()
  }, [id])

  if (!id) return null

  const save = async () => {
    await api.updateTicket(token, id!, { status })
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white p-4 rounded w-96">
        <h3 className="font-semibold">Detalhes do ticket</h3>
        {ticket && (
          <div className="mt-2">
            <div className="text-sm">{ticket.mensagem}</div>
            <div className="text-xs text-slate-500 mt-2">Setor: {ticket.setor}</div>
            <div className="mt-3">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1">
                <option value="novo">Novo</option>
                <option value="em_andamento">Em andamento</option>
                <option value="resolvido">Resolvido</option>
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1 rounded border">Cancelar</button>
              <button onClick={save} className="px-3 py-1 rounded bg-emerald-600 text-white">Salvar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TicketDetail
