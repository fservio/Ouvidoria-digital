import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api } from './api';

interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  user_id: string | null;
  created_at: string;
}

const Audit: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState({ entity_type: '', entity_id: '', user_id: '', from: '', to: '' });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.entity_id) params.entity_id = filters.entity_id;
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const data = await api.audit.list(params);
      setLogs(data.audit_logs as AuditLog[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar auditoria');
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  return (
    <AdminLayout title="Auditoria" onLogout={onLogout}>
      <div className="rounded bg-white p-4 shadow">
        <h3 className="text-lg font-semibold">Auditoria</h3>
        {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <input className="rounded border px-3 py-2 text-sm" placeholder="Entity type" value={filters.entity_type} onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="Entity id" value={filters.entity_id} onChange={(e) => setFilters({ ...filters, entity_id: e.target.value })} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="User id" value={filters.user_id} onChange={(e) => setFilters({ ...filters, user_id: e.target.value })} />
          <input className="rounded border px-3 py-2 text-sm" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <input className="rounded border px-3 py-2 text-sm" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>

        <button className="mt-3 rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={load}>Filtrar</button>

        <div className="mt-6 space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="rounded border px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{log.entity_type}</span>
                <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div className="text-xs text-slate-600">{log.action} • {log.entity_id}</div>
              {log.user_id && <div className="text-xs text-slate-500">User: {log.user_id}</div>}
            </div>
          ))}

          {logs.length === 0 && (
            <div className="text-sm text-slate-500">Nenhum log encontrado</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Audit;
