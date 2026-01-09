import React from 'react'

export const AdminLayout: React.FC<{ title?: string; children?: React.ReactNode; onLogout?: () => void }> = ({ title, children, onLogout }) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">CMS — Ouvidoria</h1>
            {title && <div className="text-sm text-slate-500">{title}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onLogout} className="rounded px-3 py-1 text-sm bg-rose-500 text-white">Sair</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-4 gap-6">
        <aside className="col-span-1 rounded bg-white p-4 shadow">
          <nav className="flex flex-col gap-2">
            <a href="/admin/tickets" className="text-sm text-slate-700">Tickets</a>
            <a href="/admin/users" className="text-sm text-slate-700">Users</a>
            <a href="/admin/relatorios" className="text-sm text-slate-700">Relatórios</a>
          </nav>
        </aside>

        <main className="col-span-3">{children}</main>
      </div>
    </div>
  )
}

export default AdminLayout
