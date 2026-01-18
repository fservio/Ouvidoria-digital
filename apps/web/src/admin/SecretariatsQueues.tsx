import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api, type Queue, type Secretariat } from './api';

const SecretariatsQueues: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [secretariats, setSecretariats] = useState<Secretariat[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newSecretariat, setNewSecretariat] = useState({ name: '', code: '', description: '', sla_hours: 72 });
  const [newQueue, setNewQueue] = useState({ name: '', slug: '', description: '', sla_hours: 48, priority: 0 });

  const load = async () => {
    setError(null);
    try {
      const data = await api.secretariats.list();
      setSecretariats(data.secretariats);
      if (!selected && data.secretariats.length > 0) {
        setSelected(data.secretariats[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar secretarias');
    }
  };

  const loadQueues = async (secretariatId: string) => {
    try {
      const data = await api.queues.list(secretariatId);
      setQueues(data.queues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar filas');
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    if (selected) {
      loadQueues(selected);
    }
  }, [selected]);

  const createSecretariat = async () => {
    setError(null);
    setSuccess(null);
    try {
      await api.secretariats.create({
        name: newSecretariat.name,
        code: newSecretariat.code,
        description: newSecretariat.description,
        sla_hours: Number(newSecretariat.sla_hours),
      });
      setSuccess('Secretaria criada');
      setNewSecretariat({ name: '', code: '', description: '', sla_hours: 72 });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar secretaria');
    }
  };

  const createQueue = async () => {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    try {
      await api.queues.create({
        secretariat_id: selected,
        name: newQueue.name,
        slug: newQueue.slug,
        description: newQueue.description,
        sla_hours: Number(newQueue.sla_hours),
        priority: Number(newQueue.priority),
      });
      setSuccess('Fila criada');
      setNewQueue({ name: '', slug: '', description: '', sla_hours: 48, priority: 0 });
      await loadQueues(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar fila');
    }
  };

  return (
    <AdminLayout title="Secretarias e Filas" onLogout={onLogout}>
      <div className="space-y-6">
        <div className="rounded bg-white p-4 shadow">
          <h3 className="text-lg font-semibold">Secretarias</h3>
          {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}
          {success && <div className="mt-2 text-sm text-emerald-600">{success}</div>}

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input className="rounded border px-3 py-2 text-sm" placeholder="Nome" value={newSecretariat.name} onChange={(e) => setNewSecretariat({ ...newSecretariat, name: e.target.value })} />
            <input className="rounded border px-3 py-2 text-sm" placeholder="Codigo" value={newSecretariat.code} onChange={(e) => setNewSecretariat({ ...newSecretariat, code: e.target.value })} />
            <input className="rounded border px-3 py-2 text-sm" placeholder="Descricao" value={newSecretariat.description} onChange={(e) => setNewSecretariat({ ...newSecretariat, description: e.target.value })} />
            <input className="rounded border px-3 py-2 text-sm" type="number" placeholder="SLA (h)" value={newSecretariat.sla_hours} onChange={(e) => setNewSecretariat({ ...newSecretariat, sla_hours: Number(e.target.value) })} />
          </div>
          <button className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm text-white" onClick={createSecretariat}>Criar secretaria</button>

          <div className="mt-6 grid gap-2">
            {secretariats.map((sec) => (
              <button key={sec.id} className={`rounded border px-3 py-2 text-left text-sm ${selected === sec.id ? 'border-blue-600 text-blue-600' : 'border-slate-200 text-slate-600'}`} onClick={() => setSelected(sec.id)}>
                {sec.name}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded bg-white p-4 shadow">
          <h3 className="text-lg font-semibold">Filas</h3>
          {!selected && <div className="text-sm text-slate-500">Selecione uma secretaria</div>}

          {selected && (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <input className="rounded border px-3 py-2 text-sm" placeholder="Nome" value={newQueue.name} onChange={(e) => setNewQueue({ ...newQueue, name: e.target.value })} />
                <input className="rounded border px-3 py-2 text-sm" placeholder="Slug" value={newQueue.slug} onChange={(e) => setNewQueue({ ...newQueue, slug: e.target.value })} />
                <input className="rounded border px-3 py-2 text-sm" placeholder="Descricao" value={newQueue.description} onChange={(e) => setNewQueue({ ...newQueue, description: e.target.value })} />
                <input className="rounded border px-3 py-2 text-sm" type="number" placeholder="SLA (h)" value={newQueue.sla_hours} onChange={(e) => setNewQueue({ ...newQueue, sla_hours: Number(e.target.value) })} />
                <input className="rounded border px-3 py-2 text-sm" type="number" placeholder="Prioridade" value={newQueue.priority} onChange={(e) => setNewQueue({ ...newQueue, priority: Number(e.target.value) })} />
              </div>
              <button className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm text-white" onClick={createQueue}>Criar fila</button>

              <div className="mt-6 grid gap-2">
                {queues.map((q) => (
                  <div key={q.id} className="rounded border px-3 py-2 text-sm">
                    <div className="font-medium">{q.name}</div>
                    <div className="text-xs text-slate-500">{q.slug}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default SecretariatsQueues;
