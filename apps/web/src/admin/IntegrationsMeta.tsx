import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api } from './api';

interface MetaIntegration {
  phone_number_id: string | null;
  test_phone_e164: string | null;
  is_enabled: boolean;
  last_test_status: string | null;
  last_test_at: string | null;
  last_error: string | null;
  has_access_token: boolean;
  has_app_secret: boolean;
}

const IntegrationsMeta: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [form, setForm] = useState({
    phone_number_id: '',
    access_token: '',
    app_secret: '',
    test_phone_e164: '',
    is_enabled: false,
  });
  const [status, setStatus] = useState<MetaIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.integrations.getMeta() as MetaIntegration;
      setStatus(data);
      setForm({
        phone_number_id: data.phone_number_id ?? '',
        access_token: '',
        app_secret: '',
        test_phone_e164: data.test_phone_e164 ?? '',
        is_enabled: Boolean(data.is_enabled),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar integracao');
    } finally {
      setLoading(false);
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
        phone_number_id: form.phone_number_id,
        test_phone_e164: form.test_phone_e164 || undefined,
        is_enabled: form.is_enabled,
        access_token: form.access_token || undefined,
        app_secret: form.app_secret || undefined,
      };
      const data = await api.integrations.updateMeta(payload) as MetaIntegration;
      setStatus(data);
      setSuccess('Integracao salva com sucesso');
      setForm((prev) => ({
        ...prev,
        access_token: '',
        app_secret: '',
      }));
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
      const data = await api.integrations.testMeta() as { ok: boolean; last_test_status: string | null; last_test_at: string | null; last_error: string | null };
      setStatus((prev) => prev ? { ...prev, ...data } : prev);
      setSuccess(data.ok ? 'Teste concluido com sucesso' : 'Teste falhou');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao testar integracao');
    } finally {
      setTesting(false);
    }
  };

  return (
    <AdminLayout title="Integrações - WhatsApp (Meta)" onLogout={onLogout}>
      <div className="space-y-6">
        <div className="rounded bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">WhatsApp (Meta)</h3>
            <button
              onClick={save}
              disabled={saving}
              className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          {loading ? (
            <div className="mt-4 text-sm text-slate-500">Carregando...</div>
          ) : (
            <div className="mt-4 grid gap-4">
              <label className="text-sm">
                <span className="text-slate-600">Phone number ID</span>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.phone_number_id}
                  onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
                  placeholder="1234567890"
                />
              </label>

              <label className="text-sm">
                <span className="text-slate-600">Access token</span>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  type="password"
                  value={form.access_token}
                  onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                  placeholder={status?.has_access_token ? '******** (salvo)' : 'token'}
                />
              </label>

              <label className="text-sm">
                <span className="text-slate-600">App secret</span>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  type="password"
                  value={form.app_secret}
                  onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
                  placeholder={status?.has_app_secret ? '******** (salvo)' : 'secret'}
                />
              </label>

              <label className="text-sm">
                <span className="text-slate-600">Telefone de teste (E.164)</span>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.test_phone_e164}
                  onChange={(e) => setForm({ ...form, test_phone_e164: e.target.value })}
                  placeholder="+5586..."
                />
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_enabled}
                  onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
                />
                <span className="text-slate-600">Integracao habilitada</span>
              </label>

              {(error || success) && (
                <div className={`rounded px-3 py-2 text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {error ?? success}
                </div>
              )}
            </div>
          )}
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

export default IntegrationsMeta;
