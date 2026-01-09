import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? '';

type Ticket = {
  id: string;
  nome: string;
  mensagem: string;
  setor: string;
  status: string;
  created_at: string;
};

import AdminApp from './admin/AdminApp'

const App = () => {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return <AdminApp />
  }
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [protocolo, setProtocolo] = useState('');
  const [consultaId, setConsultaId] = useState('');
  const [consultaStatus, setConsultaStatus] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [token, setToken] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const criarTicket = async () => {
    setErro(null);
    const res = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, mensagem })
    });
    if (!res.ok) {
      setErro('Não foi possível registrar sua demanda.');
      return;
    }
    const data = await res.json();
    setProtocolo(data.protocolo);
    setNome('');
    setMensagem('');
  };

  const consultarStatus = async () => {
    setErro(null);
    const res = await fetch(`${API_URL}/tickets/${consultaId}`);
    if (!res.ok) {
      setErro('Protocolo não encontrado.');
      return;
    }
    const data = await res.json();
    setConsultaStatus(data.status);
  };

  const autenticar = async () => {
    setErro(null);
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    if (!res.ok) {
      setErro('Credenciais inválidas.');
      return;
    }
    const data = await res.json();
    setToken(data.token);
  };

  const carregarTickets = async () => {
    if (!token) return;
    setErro(null);
    const res = await fetch(`${API_URL}/secretaria/tickets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      setErro('Não foi possível carregar tickets.');
      return;
    }
    const data = await res.json();
    setTickets(data.tickets ?? []);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <h1 className="text-2xl font-semibold text-slate-900">Ouvidoria Digital</h1>
          <p className="text-sm text-slate-500">
            Plataforma inteligente de atendimento às demandas públicas.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Registrar demanda</h2>
          <p className="text-sm text-slate-500">Envie sua solicitação para análise automática.</p>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Nome"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
            />
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Descreva sua demanda"
              rows={4}
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
            />
            <button
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={criarTicket}
            >
              Enviar
            </button>
            {protocolo && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                Protocolo gerado: <strong>{protocolo}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Consultar status</h2>
          <p className="text-sm text-slate-500">Informe o código do protocolo para acompanhar.</p>
          <div className="mt-4 flex flex-col gap-3">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Protocolo"
              value={consultaId}
              onChange={(event) => setConsultaId(event.target.value)}
            />
            <button
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
              onClick={consultarStatus}
            >
              Consultar
            </button>
            {consultaStatus && (
              <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                Status atual: <strong>{consultaStatus}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow lg:col-span-2">
          <h2 className="text-lg font-semibold">Painel Secretaria</h2>
          <p className="text-sm text-slate-500">Acesse com o perfil de secretaria para ver os tickets.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Senha"
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
              />
              <button
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                onClick={autenticar}
              >
                Entrar
              </button>
              <button
                className="w-full rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
                onClick={carregarTickets}
                disabled={!token}
              >
                Carregar tickets
              </button>
            </div>

            <div className="lg:col-span-2">
              <div className="grid gap-3">
                {tickets.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Nenhum ticket carregado ainda.
                  </div>
                )}
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{ticket.nome}</h3>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                        {ticket.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{ticket.mensagem}</p>
                    <p className="mt-2 text-xs text-slate-400">Setor: {ticket.setor}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {erro && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-600 shadow">
          {erro}
        </div>
      )}
    </div>
  );
};

export default App;
