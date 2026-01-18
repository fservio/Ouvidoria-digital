import React, { useEffect, useState } from 'react';
import { api, type Case } from './api';

const statusColors: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  routing: 'bg-yellow-100 text-yellow-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  waiting_citizen: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-700',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-50 text-gray-500',
  normal: 'bg-blue-50 text-blue-600',
  high: 'bg-orange-50 text-orange-600',
  urgent: 'bg-red-50 text-red-600',
};

interface Props {
  token: string;
  onLogout: () => void;
}

type TokenPayload = { role?: string };

const decodeToken = (token: string): TokenPayload | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    return JSON.parse(decoded) as TokenPayload;
  } catch {
    return null;
  }
};

export default function Tickets({ token, onLogout }: Props) {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const role = decodeToken(token)?.role;
  const canEditCase = role !== 'GABINETE_VIEWER_GLOBAL';
  const canEditOperational = role !== 'GABINETE_VIEWER_GLOBAL';

  useEffect(() => {
    loadCases();
  }, [filters, page]);

  const loadCases = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: '20',
      };
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.search) params.search = filters.search;

      const data = await api.cases.list(params);
      setCases(data.cases);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar casos');
    } finally {
      setLoading(false);
    }
  };

  const getSLAStatus = (slaDueAt: string | null, breached: number) => {
    if (!slaDueAt) return null;
    if (breached) return { label: 'SLA Estourado', color: 'bg-red-100 text-red-700' };

    const now = new Date();
    const due = new Date(slaDueAt);
    const hoursLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft < 0) return { label: 'SLA Estourado', color: 'bg-red-100 text-red-700' };
    if (hoursLeft < 4) return { label: `${Math.ceil(hoursLeft)}h restantes`, color: 'bg-orange-100 text-orange-700' };
    if (hoursLeft < 24) return { label: `${Math.ceil(hoursLeft)}h restantes`, color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'No prazo', color: 'bg-green-100 text-green-700' };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Ouvidoria Digital - Casos</h1>
            <button
              onClick={onLogout}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex gap-4">
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Todos os status</option>
            <option value="new">Novo</option>
            <option value="routing">Em roteamento</option>
            <option value="assigned">Atribuído</option>
            <option value="in_progress">Em andamento</option>
            <option value="waiting_citizen">Aguardando cidadão</option>
            <option value="resolved">Resolvido</option>
            <option value="closed">Encerrado</option>
          </select>

          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          >
            <option value="">Todas prioridades</option>
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>

          <input
            type="text"
            placeholder="Buscar protocolo, telefone, nome..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />

          <button
            onClick={loadCases}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Buscar
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Mostrando {cases.length} de {total} casos
            </div>

            <div className="space-y-3">
              {cases.map((caseItem) => {
                const slaStatus = getSLAStatus(caseItem.sla_due_at, caseItem.sla_breached);
                return (
                  <div
                    key={caseItem.id}
                    className="cursor-pointer rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                    onClick={() => setSelectedCase(caseItem)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-medium text-gray-900">
                            {caseItem.protocol}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[caseItem.status] || 'bg-gray-100'}`}>
                            {caseItem.status.replace('_', ' ')}
                          </span>
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${priorityColors[caseItem.priority] || 'bg-gray-100'}`}>
                            {caseItem.priority}
                          </span>
                          {slaStatus && (
                            <span className={`rounded px-2 py-0.5 text-xs font-medium ${slaStatus.color}`}>
                              {slaStatus.label}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">{caseItem.citizen_name || 'Anônimo'}</span>
                          <span className="mx-2">•</span>
                          <span>{caseItem.citizen_phone}</span>
                        </div>
                        {caseItem.queue_name && (
                          <div className="mt-1 text-sm text-gray-500">
                            {caseItem.queue_name}
                            {caseItem.secretariat_name && ` • ${caseItem.secretariat_name}`}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {new Date(caseItem.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                );
              })}

              {cases.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center text-gray-500">
                  Nenhum caso encontrado
                </div>
              )}
            </div>

            {total > 20 && (
              <div className="mt-6 flex justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Página {page}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={cases.length < 20}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {selectedCase && (
        <CaseDetailModal
          case={selectedCase}
          onClose={() => setSelectedCase(null)}
          onUpdated={loadCases}
          canEdit={canEditCase}
        />
      )}
    </div>
  );
}

function CaseDetailModal({ case: caseItem, onClose, onUpdated, canEdit }: { case: Case; onClose: () => void; onUpdated: () => void; canEdit: boolean }) {
  const [activeTab, setActiveTab] = useState<'messages' | 'details' | 'audit'>('messages');
  const [messages, setMessages] = useState<Array<{ id: string; direction: string; content: string | null; created_at: string; delivery_status?: string; last_error?: string }>>([]);
  const [detail, setDetail] = useState<any>(null);
  const [citizenDraft, setCitizenDraft] = useState<{ full_name: string; email: string; phone_e164: string }>({ full_name: '', email: '', phone_e164: '' });
  const [missingFields, setMissingFields] = useState<Array<{ field_name: string }>>([]);
  const [secretariats, setSecretariats] = useState<Array<{ id: string; name: string }>>([]);
  const [queues, setQueues] = useState<Array<{ id: string; name: string }>>([]);
  const [assignees, setAssignees] = useState<Array<{ id: string; nome: string }>>([]);
  const [status, setStatus] = useState(caseItem.status);
  const [priority, setPriority] = useState(caseItem.priority);
  const [secretariatId, setSecretariatId] = useState<string>('');
  const [queueId, setQueueId] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [externalText, setExternalText] = useState('');
  const [internalText, setInternalText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.cases.get(caseItem.id) as any;
      setDetail(data);
      setMessages(data.messages || []);
      setMissingFields(data.missing_fields || []);
      setStatus(data.status);
      setPriority(data.priority);
      setSecretariatId(data.secretariat_id || '');
      setQueueId(data.queue_id || '');
      setAssignedTo(data.assigned_to || '');
      if (data.citizen) {
        setCitizenDraft({
          full_name: data.citizen.full_name || '',
          email: data.citizen.email || '',
          phone_e164: data.citizen.phone_e164 || '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [caseItem.id]);

  useEffect(() => {
    const loadSecretariats = async () => {
      try {
        const data = await api.secretariats.list();
        setSecretariats(data.secretariats as Array<{ id: string; name: string }>);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar secretarias');
      }
    };
    loadSecretariats();
  }, []);

  useEffect(() => {
    if (!secretariatId) return;
    const loadQueues = async () => {
      try {
        const data = await api.queues.list(secretariatId);
        setQueues(data.queues as Array<{ id: string; name: string }>);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar filas');
      }
    };
    const loadAssignees = async () => {
      try {
        const data = await api.users.listBySecretariat(secretariatId);
        setAssignees(data.users as Array<{ id: string; nome: string }>);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar responsaveis');
      }
    };
    loadQueues();
    loadAssignees();
  }, [secretariatId]);

  const resend = async (messageId: string) => {
    try {
      await api.cases.resendMessage(messageId);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reenviar');
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.cases.update(caseItem.id, {
        status,
        priority,
        queue_id: queueId || undefined,
        assigned_to: assignedTo || undefined,
      } as any);
      await loadDetail();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar caso');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="font-mono text-lg font-semibold">{caseItem.protocol}</h2>
            <p className="text-sm text-gray-500">
              {caseItem.citizen_name || 'Anônimo'} • {caseItem.citizen_phone}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b px-6">
          <div className="flex gap-6">
            {(['messages', 'details', 'audit'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 py-3 text-sm font-medium capitalize ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'messages' ? 'Mensagens' : tab === 'details' ? 'Detalhes' : 'Auditoria'}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {loading && <div className="text-sm text-gray-500">Carregando...</div>}
          {error && <div className="text-sm text-rose-600">{error}</div>}

          {activeTab === 'messages' && (
            <div className="space-y-3">
              {messages.length === 0 && !loading && (
                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                  Nenhuma mensagem registrada.
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className="rounded border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase text-gray-400">{msg.direction}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="mt-2 text-gray-700">{msg.content}</p>
                  {msg.delivery_status && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <span>Status: {msg.delivery_status}</span>
                      {msg.delivery_status === 'failed' && (
                        <button
                          onClick={() => resend(msg.id)}
                          className="rounded border px-2 py-1 text-xs"
                        >
                          Reenviar
                        </button>
                      )}
                    </div>
                  )}
                  {msg.last_error && (
                    <div className="mt-1 text-xs text-rose-600">Erro: {msg.last_error}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              {!canEdit && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Modo somente leitura para este perfil.
                </div>
              )}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Status</label>
                    <p className="mt-1 capitalize">{detail?.status ?? caseItem.status}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Prioridade</label>
                    <p className="mt-1 capitalize">{detail?.priority ?? caseItem.priority}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Criado em</label>
                    <p className="mt-1">{new Date(caseItem.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Secretaria</label>
                    <p className="mt-1">{detail?.secretariat_name || caseItem.secretariat_name || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Fila</label>
                    <p className="mt-1">{detail?.queue_name || caseItem.queue_name || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Prazo SLA</label>
                    <p className="mt-1">
                      {detail?.sla_due_at
                        ? new Date(detail.sla_due_at).toLocaleString('pt-BR')
                        : caseItem.sla_due_at
                          ? new Date(caseItem.sla_due_at).toLocaleString('pt-BR')
                          : 'Não definido'}
                    </p>
                  </div>
                </div>
              </div>

              {detail?.citizen && (
                <div className="rounded border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-medium text-slate-500">Cidadão</div>
                  <div className="mt-2 grid gap-3 text-sm">
                    <input
                      className="w-full rounded border px-2 py-1"
                      placeholder="Nome"
                      value={citizenDraft.full_name}
                      onChange={(event) => setCitizenDraft({ ...citizenDraft, full_name: event.target.value })}
                      disabled={!canEdit}
                    />
                    <input
                      className="w-full rounded border px-2 py-1"
                      placeholder="Email"
                      value={citizenDraft.email}
                      onChange={(event) => setCitizenDraft({ ...citizenDraft, email: event.target.value })}
                      disabled={!canEdit}
                    />
                    <input
                      className="w-full rounded border px-2 py-1"
                      placeholder="Telefone (E.164)"
                      value={citizenDraft.phone_e164}
                      onChange={(event) => setCitizenDraft({ ...citizenDraft, phone_e164: event.target.value })}
                      disabled={!canEdit}
                    />
                    <button
                      className="self-start rounded border px-3 py-1 text-xs disabled:opacity-50"
                      disabled={!canEdit}
                      onClick={async () => {
                        await api.citizens.update(detail.citizen.id, citizenDraft);
                        await loadDetail();
                      }}
                    >
                      Salvar cidadão
                    </button>
                  </div>
                </div>
              )}

              {missingFields.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500">Dados pendentes</label>
                  <ul className="mt-2 list-disc pl-4 text-sm text-gray-600">
                    {missingFields.map((field) => (
                      <li key={field.field_name}>{field.field_name}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Alterar status</label>
                  <select className="mt-2 w-full rounded border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit}>
                    <option value="new">Novo</option>
                    <option value="routing">Em roteamento</option>
                    <option value="assigned">Atribuído</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="waiting_citizen">Aguardando cidadão</option>
                    <option value="resolved">Resolvido</option>
                    <option value="closed">Encerrado</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Prioridade</label>
                  <select className="mt-2 w-full rounded border px-3 py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!canEdit}>
                    <option value="low">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Secretaria</label>
                  <select className="mt-2 w-full rounded border px-3 py-2 text-sm" value={secretariatId} onChange={(e) => setSecretariatId(e.target.value)} disabled={!canEdit}>
                    <option value="">Selecione</option>
                    {secretariats.map((sec) => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Responsável</label>
                  <select className="mt-2 w-full rounded border px-3 py-2 text-sm" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} disabled={!canEdit}>
                    <option value="">Sem responsável</option>
                    {assignees.map((user) => (
                      <option key={user.id} value={user.id}>{user.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500">Fila</label>
                  <select className="mt-2 w-full rounded border px-3 py-2 text-sm" value={queueId} onChange={(e) => setQueueId(e.target.value)} disabled={!canEdit}>
                    <option value="">Selecione</option>
                    {queues.map((queue) => (
                      <option key={queue.id} value={queue.id}>{queue.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 flex items-end">
                  <button
                    onClick={save}
                    disabled={saving || !canEdit}
                    className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <CaseAudit caseId={caseItem.id} />
          )}
        </div>

        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="grid gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500">Responder ao cidadão</label>
              <textarea
                className="mt-2 w-full rounded border px-3 py-2 text-sm"
                rows={3}
                placeholder={canEdit ? "Digite a resposta..." : "Somente leitura"}
                value={externalText}
                onChange={(e) => setExternalText(e.target.value)}
                disabled={!canEdit}
              />
              <button
                onClick={async () => {
                  if (!externalText.trim()) return;
                  await api.cases.sendMessage(caseItem.id, externalText, false);
                  setExternalText('');
                  await loadDetail();
                }}
                disabled={!canEdit}
                className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Enviar resposta
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Nota interna</label>
              <textarea
                className="mt-2 w-full rounded border px-3 py-2 text-sm"
                rows={3}
                placeholder={canEdit ? "Adicionar nota interna..." : "Somente leitura"}
                value={internalText}
                onChange={(e) => setInternalText(e.target.value)}
                disabled={!canEdit}
              />
              <button
                onClick={async () => {
                  if (!internalText.trim()) return;
                  await api.cases.sendMessage(caseItem.id, internalText, true);
                  setInternalText('');
                  await loadDetail();
                }}
                disabled={!canEdit}
                className="mt-2 rounded border px-4 py-2 text-sm disabled:opacity-50"
              >
                Salvar nota
              </button>
            </div>

            <div className="text-xs text-slate-500">Anexos (em breve)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseAudit({ caseId }: { caseId: string }) {
  const [logs, setLogs] = useState<Array<{ id: string; summary: string; created_at: string; actor_user?: { name: string; role: string } | null; actor_type: string }>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (append = false) => {
    setLoading(true);
    const params: Record<string, string> = { limit: '20' };
    if (append && cursor) params.cursor = cursor;

    const res = await api.audit.listCase(caseId, params);
    const newLogs = res.logs as Array<{ id: string; summary: string; created_at: string; actor_user?: { name: string; role: string } | null; actor_type: string }>;

    setLogs((prev) => append ? prev.concat(newLogs) : newLogs);
    setCursor(res.next_cursor || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [caseId]);

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="rounded border px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="font-medium">{log.summary}</div>
            <div className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString('pt-BR')}</div>
          </div>
          <div className="text-xs text-slate-600">
            {log.actor_user?.name ?? 'Sistema'} • {log.actor_user?.role ?? log.actor_type}
          </div>
        </div>
      ))}

      {logs.length === 0 && !loading && (
        <div className="text-sm text-slate-500">Sem logs ainda.</div>
      )}

      {cursor && (
        <button
          onClick={() => load(true)}
          className="rounded border px-3 py-2 text-xs"
          disabled={loading}
        >
          {loading ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
