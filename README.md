Ouvidoria Digital

* Visão geral do projeto
* Stack detalhada
* Arquitetura
* Comandos
* Estrutura de pastas
* Deploy com Wrangler
* Ambiente e variáveis
* Validação e testes
* Roadmap
* Licença

---

```md
# 📢 Ouvidoria Digital para Municípios

Sistema de ouvidoria pública **inteligente e automatizado**, desenvolvido com **Cloudflare Workers**, **Hono**, **D1** e **GPT-4**, visando transformar a comunicação entre cidadãos e secretarias municipais.

---

## 🧠 Visão Geral

A plataforma permite que o cidadão registre reclamações, sugestões ou dúvidas por meio de um formulário simples. A inteligência artificial classifica automaticamente o setor responsável (educação, saúde, infraestrutura, trânsito), gera respostas automáticas e direciona a demanda para o painel de gestão da secretaria correspondente.

---

## 🚀 Stack Tecnológica

| Camada         | Tecnologia                             |
|----------------|-----------------------------------------|
| Frontend       | React + Tailwind (Cloudflare Pages)     |
| API            | Hono (Node.js ESM)                      |
| Backend infra  | Cloudflare Workers                      |
| Banco de dados | D1 (SQLite edge)                        |
| Cache          | KV (Rate limit, sessões, JWT)           |
| IA             | GPT-4 via OpenAI API                    |
| PDF            | jsPDF (client-side) ou edge generator   |
| Auth           | JWT com RBAC (cidadão, secretaria, gestor) |
| Automação opc. | n8n via Webhook (externo)               |

---

## 🧩 Funcionalidades

### 🎫 Cidadão
- Formulário com nome, mensagem e setor (opcional)
- Upload de imagem (futuro)
- Recebimento de número de protocolo
- Acompanhamento via link ou código

### 🏛️ Secretaria
- Login seguro por JWT
- Visualização de tickets filtrados
- Atualização de status (em análise, resolvido)
- Respostas geradas por IA
- Geração de relatórios por período

### 📈 Gestão
- Painel com indicadores: SLA, demandas abertas, NPS
- Exportação de relatórios em PDF
- Visualização de desempenho por secretaria

---

## 🏗️ Estrutura de Pastas

```

ouvidoria-digital/
├── src/
│   ├── app.ts                 # Entrypoint Hono
│   ├── routes/                # Rotas da API
│   ├── middleware/            # JWT, logs, rate limit
│   ├── lib/                   # GPT, banco, utilitários
│   ├── schema/                # Zod validation
│   └── validate.ts            # Validação do projeto
├── public/                    # Assets estáticos
├── tests/                     # Testes unitários
├── .github/workflows/ci.yml  # CI com Node.js
├── wrangler.toml             # Configuração Cloudflare
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
└── README.md

````

---

## 🧪 Validação Padrão

```bash
npm run validate
````

Executa:

* TypeScript strict check (`tsc --noEmit`)
* ESLint linting (`eslint .`)
* Testes com cobertura (`vitest run --coverage`)
* Valida variáveis de ambiente obrigatórias

---

## ⚙️ Variáveis de Ambiente (`wrangler.toml`)

```toml
[vars]
JWT_SECRET = "chave_segura"
OPENAI_API_KEY = "sk-..."
```

---

## 📦 Scripts Principais

```bash
npm install        # Instala dependências
npm run dev        # Inicia API local com Miniflare
npm run test       # Executa testes com Vitest
npm run lint       # Lint com ESLint
npm run validate   # Validação completa
```

---

## 🛠️ Deploy

### 🔧 Pré-requisitos

* Conta no [Cloudflare](https://dash.cloudflare.com/)
* Instalar CLI Wrangler: `npm i -g wrangler`

### 🚀 Deploy API

```bash
wrangler publish
```

### 🌐 Deploy Frontend (se React SPA)

```bash
cd frontend/
npm run build
npx wrangler pages deploy dist --project-name ouvidoria-frontend
```

---

## 🧪 Testes

Estrutura mínima:

```
tests/
├── auth.test.ts
├── tickets.test.ts
├── db.test.ts
```

Cobertura esperada: **>85%**, incluindo caminhos de falha.

---

## 🗺️ Roadmap

* [x] MVP API (Tickets, Auth, Classificação IA)
* [ ] Painel por secretaria (React SPA)
* [ ] Geração de relatórios em PDF
* [ ] Integração com WhatsApp via n8n
* [ ] Dashboard com indicadores
* [ ] Avaliação de satisfação por ticket
* [ ] Multi-cidade (SaaS por município)

---

## 🛡️ Licença

MIT © 2026 - Ouvidoria Digital

---

> Feito com ❤️ para transformar a escuta pública com tecnologia acessível e inteligente.

```

---

Esse `README.md` pode ser incluído no seu repositório GitHub e adaptado conforme o projeto evolui.

Deseja que eu prepare um `repo.zip` inicial com essa estrutura? Ou quer que eu suba para um repositório se você me fornecer o nome e token temporário?
```
