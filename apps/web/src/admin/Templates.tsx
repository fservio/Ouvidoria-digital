import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { api } from './api';

interface Template {
  id: string;
  template_key: string;
  version: number;
  is_active: number;
  content: string;
  created_at: string;
  created_by: string | null;
}

const Templates: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const groups: Record<string, Template[]> = {};
    templates.forEach((tmpl) => {
      if (!groups[tmpl.template_key]) groups[tmpl.template_key] = [];
      groups[tmpl.template_key].push(tmpl);
    });
    return groups;
  }, [templates]);

  const load = async () => {
    setError(null);
    try {
      const data = await api.templates.list();
      const list = data.templates as Template[];
      setTemplates(list);
      if (!selectedKey && list.length > 0) {
        setSelectedKey(list[0].template_key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar templates');
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    if (!selectedKey) return;
    const active = grouped[selectedKey]?.find((tmpl) => tmpl.is_active === 1);
    if (active) {
      setContent(active.content);
    }
  }, [grouped, selectedKey]);

  const createVersion = async () => {
    if (!selectedKey) return;
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      await api.templates.createVersion(selectedKey, content);
      setSuccess('Nova versao criada');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar versao');
    } finally {
      setSaving(false);
    }
  };

  const activate = async (tmpl: Template) => {
    setSaving(true);
    setError(null);
    try {
      await api.templates.activate(selectedKey, tmpl.id);
      setSuccess('Versao ativada');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ativar versao');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Templates" onLogout={onLogout}>
      <div className="grid gap-6">
        <div className="rounded bg-white p-4 shadow">
          <h3 className="text-lg font-semibold">Templates de Mensagem</h3>
          {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}
          {success && <div className="mt-2 text-sm text-emerald-600">{success}</div>}

          <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              {Object.keys(grouped).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${selectedKey === key ? 'border-blue-600 text-blue-600' : 'border-slate-200 text-slate-600'}`}
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-600">Conteudo</label>
                <textarea
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={createVersion}
                  disabled={saving}
                  className="rounded bg-emerald-600 px-3 py-2 text-sm text-white"
                >
                  Criar nova versao
                </button>
              </div>

              <div className="rounded border border-slate-200 p-3">
                <h4 className="text-sm font-semibold text-slate-700">Historico de versoes</h4>
                <div className="mt-3 space-y-2">
                  {grouped[selectedKey]?.map((tmpl) => (
                    <div key={tmpl.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium">v{tmpl.version}</div>
                        <div className="text-xs text-slate-500">{new Date(tmpl.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {tmpl.is_active === 1 && (
                          <span className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Ativo</span>
                        )}
                        {tmpl.is_active !== 1 && (
                          <button
                            onClick={() => activate(tmpl)}
                            className="rounded border px-2 py-1 text-xs"
                          >
                            Ativar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Templates;
