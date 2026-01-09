import React, { useState } from 'react'

const TicketFilters: React.FC<{ onChange: (filters: Record<string, string>) => void }> = ({ onChange }) => {
  const [setor, setSetor] = useState('')
  const [status, setStatus] = useState('')

  const apply = () => onChange({ ...(setor ? { setor } : {}), ...(status ? { status } : {}) })

  return (
    <div className="flex gap-2 items-center mb-3">
      <select value={setor} onChange={(e) => setSetor(e.target.value)} className="border rounded px-2 py-1">
        <option value="">Todos os setores</option>
        <option value="saude">Saúde</option>
        <option value="educacao">Educação</option>
        <option value="transito">Trânsito</option>
        <option value="infraestrutura">Infraestrutura</option>
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1">
        <option value="">Todos os status</option>
        <option value="novo">Novo</option>
        <option value="em_andamento">Em andamento</option>
        <option value="resolvido">Resolvido</option>
      </select>
      <button onClick={apply} className="rounded bg-slate-900 px-3 py-1 text-white">Aplicar</button>
    </div>
  )
}

export default TicketFilters
