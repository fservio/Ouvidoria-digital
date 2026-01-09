import React from 'react'

const Pagination: React.FC<{ page: number; totalPages: number; onChange: (p: number) => void }> = ({ page, totalPages, onChange }) => {
  return (
    <div className="flex items-center gap-2 mt-4">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="px-3 py-1 rounded bg-slate-100">Anterior</button>
      <div className="text-sm">{page} / {totalPages}</div>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="px-3 py-1 rounded bg-slate-100">Próxima</button>
    </div>
  )
}

export default Pagination
