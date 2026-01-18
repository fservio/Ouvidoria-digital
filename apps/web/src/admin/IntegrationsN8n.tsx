import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api } from './api';

interface N8nIntegration {
  endpoint_url: string | null;
  enabled: boolean;
  agent_enabled: boolean;
  auto_send_enabled: boolean;
  handoff_threshold: number;
  risk_keywords: string[];
  allowed_actions: string[];
  has_hmac_secret: boolean;
  last_test_status?: string | null;
  last_test_at?: string | null;
  last_error?: string | null;
}

const IntegrationsN8n: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [form, setForm] = useState({
    endpoint_url: '',
    hmac_secret: '',
    enabled: false,
    agent_enabled: false,
    auto_send_enabled: false,
    handoff_threshold: '0.7',
    risk_keywords: '',
    allowed_actions: '',
  });
  const [status, setStatus] = useState<N8nIntegration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const data = await api.integrations.getN8n() as N8nIntegration;
      setStatus(data);
      setForm({
        endpoint_url: data.endpoint_url ?? '',
        hmac_secret: '',
        enabled: Boolean(data.enabled),
        agent_enabled: Boolean(data.agent_enabled),
        auto_send_enabled: Boolean(data.auto_send_enabled),
        handoff_threshold: String(data.handoff_threshold ?? 0.7),
        risk_keywords: (data.risk_keywords ?? []).join(', '),
        allowed_actions: (data.allowed_actions ?? []).join(', '),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar integracao');
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        endpoint_url: form.endpoint_url || undefined,
        hmac_secret: form.hmac_secret || undefined,
        enabled: form.enabled,
        agent_enabled: form.agent_enabled,
        auto_send_enabled: form.auto_send_enabled,
        handoff_threshold: Number(form.handoff_threshold),
        risk_keywords: form.risk_keywords.split(',').map((item) => item.trim()).filter(Boolean),
        allowed_actions: form.allowed_actions.split(',').map((item) => item.trim()).filter(Boolean),
      };
      const data = await api.integrations.updateN8n(payload) as N8nIntegration;
      setStatus(data);
      setSuccess('Integracao salva com sucesso');
      setForm((prev) => ({ ...prev, hmac_secret: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar integracao');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await api.integrations.testN8n() as { ok: boolean; last_test_status: string | null; last_test_at: string | null; last_error: string | null };
      setStatus((prev) => prev ? { ...prev, ...data } : prev);
      setSuccess(data.ok ? 'Teste concluido com sucesso' : 'Teste falhou');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao testar integracao');
    } finally {
      setTesting(false);
    }
  };

  return (
    <AdminLayout title="Integrações - n8n" onLogout={onLogout}>
      <div className="space-y-6">
        <div className="rounded bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">n8n (Agent)</h3>
            <button
              onClick={save}
              disabled={saving}
              className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            <label className="text-sm">
              <span className="text-slate-600">Endpoint URL</span>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.endpoint_url}
                onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })}
                placeholder="https://.../webhook"
              />
            </label>

            <label className="text-sm">
              <span className="text-slate-600">HMAC secret</span>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                type="password"
                value={form.hmac_secret}
                onChange={(e) => setForm({ ...form, hmac_secret: e.target.value })}
                placeholder={status?.has_hmac_secret ? '******** (salvo)' : 'secret'}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              <span className="text-slate-600">Integracao habilitada</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.agent_enabled}
                onChange={(e) => setForm({ ...form, agent_enabled: e.target.checked })}
              />
              <span className="text-slate-600">Agente habilitado</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.auto_send_enabled}
                onChange={(e) => setForm({ ...form, auto_send_enabled: e.target.checked })}
              />
              <span className="text-slate-600">Auto envio habilitado</span>
            </label>

            <label className="text-sm">
              <span className="text-slate-600">Threshold de handoff</span>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.handoff_threshold}
                onChange={(e) => setForm({ ...form, handoff_threshold: e.target.value })}
                placeholder="0.7"
              />
            </label>

            <label className="text-sm">
              <span className="text-slate-600">Risk keywords (separadas por virgula)</span>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.risk_keywords}
                onChange={(e) => setForm({ ...form, risk_keywords: e.target.value })}
                placeholder="agressao, violencia, ameaca"
              />
            </label>

            <label className="text-sm">
              <span className="text-slate-600">Allowed actions (separadas por virgula)</span>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.allowed_actions}
                onChange={(e) => setForm({ ...form, allowed_actions: e.target.value })}
                placeholder="reply_external,request_info,set_tags,set_priority"
              />
            </label>

            {(error || success) && (
              <div className={`rounded px-3 py-2 text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {error ?? success}
              </div>
            )}
          </div>
        </div>

        <div className="rounded bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Status</h4>
            <button
              onClick={testConnection}
              disabled={testing}
              className="rounded border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {testing ? 'Testando...' : 'Testar conexao'}
            </button>
          </div>

          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <div>Status: {status?.last_test_status ?? 'Sem testes'}</div>
            <div>Ultimo teste: {status?.last_test_at ? new Date(status.last_test_at).toLocaleString('pt-BR') : '-'}</div>
            <div>Ultimo erro: {status?.last_error ?? '-'}</div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default IntegrationsN8n;
