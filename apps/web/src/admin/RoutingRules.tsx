import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api } from './api';

interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  enabled: number;
  conditions: unknown;
  actions: unknown;
  description?: string | null;
}

const RoutingRules: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [simulation, setSimulation] = useState<{ rule_applied: string | null } | null>(null);

  const load = async () => {
    try {
      const data = await api.routingRules.list();
      setRules(data.rules as RoutingRule[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar regras');
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const toggle = async (id: string) => {
    try {
      await api.routingRules.toggle(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alternar regra');
    }
  };

  const simulate = async () => {
    try {
      const data = await api.routingRules.simulate(message) as { result: { rule_applied: string | null } };
      setSimulation(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao simular');
    }
  };

  return (
    <AdminLayout title="Regras de Roteamento" onLogout={onLogout}>
      <div className="space-y-6">
        <div className="rounded bg-white p-4 shadow">
          <h3 className="text-lg font-semibold">Regras</h3>
          {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}
          <div className="mt-4 space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded border px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{rule.name}</div>
                    <div className="text-xs text-slate-500">Prioridade: {rule.priority}</div>
                  </div>
                  <button
                    onClick={() => toggle(rule.id)}
                    className={`rounded px-2 py-1 text-xs ${rule.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {rule.enabled ? 'Ativa' : 'Inativa'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded bg-white p-4 shadow">
          <h3 className="text-lg font-semibold">Simulador</h3>
          <textarea
            className="mt-2 w-full rounded border px-3 py-2 text-sm"
            rows={4}
            placeholder="Digite uma mensagem de exemplo..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            onClick={simulate}
            className="mt-3 rounded bg-blue-600 px-3 py-2 text-sm text-white"
          >
            Simular
          </button>
          {simulation && (
            <div className="mt-3 text-sm text-slate-600">
              Regra aplicada: {simulation.rule_applied ?? 'Nenhuma'}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default RoutingRules;
