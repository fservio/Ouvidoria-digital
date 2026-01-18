# Ouvidoria Digital - Teresina (Piloto)

Sistema de Ouvidoria Digital para o municipio de Teresina com recebimento de manifestacoes via WhatsApp, geracao de protocolos nao adivinhaveis e roteamento automatico para secretarias e filas.

## Visao Geral

- Canal principal: WhatsApp (Meta Cloud API)
- Core standalone (sem e-Ouv por enquanto)
- Casos com protocolo alto-entropia
- Painel Admin para atendimento, roteamento e auditoria
- Stack Cloudflare (Workers + Pages + D1 + R2 + KV + Queues)
- n8n integrado via eventos com allowlist + HMAC

## Arquitetura

Fluxo inbound:

1. Cidadao envia mensagem no WhatsApp
2. Meta Webhook -> Worker (valida assinatura, persiste, enfileira)
3. Case criado com protocolo (alta entropia)
4. Roteamento por regras deterministicas (DSL)
5. (Opcional) evento para n8n com sugestoes

Fluxo outbound:

1. Operador responde no Admin
2. Mensagem enfileirada
3. Worker envia via Meta API

## Estrutura de Pastas

- `apps/api` - Workers API (Hono)
- `apps/web` - Pages admin (React)
- `apps/api/schema.sql` - Schema D1 + seed

## Configuracao Cloudflare (Setup Inicial)

### D1

```bash
npx wrangler@latest d1 create ouvidoria_d1
npx wrangler@latest d1 execute ouvidoria_d1 --remote --file schema.sql
```

### KV

```bash
npx wrangler@latest kv namespace create OUVIDORIA_KV
```

Atualize o `wrangler.toml` com o ID retornado.

### Queues

Requer Workers Paid plan.

```bash
npx wrangler@latest queues create q_inbound_message_received
npx wrangler@latest queues create q_outbound_message_send
npx wrangler@latest queues create q_n8n_events
npx wrangler@latest queues create q_sla_risk
```

Atualize o `wrangler.toml` com bindings e consumers.

### R2

```bash
npx wrangler@latest r2 bucket create ouvidoria-attachments
```

## Variaveis e Segredos

### Variaveis (wrangler.toml)

- `WEBHOOK_VERIFY_TOKEN`
- `JWT_SECRET`

### Segredos (wrangler)

```bash
npx wrangler@latest secret put JWT_SECRET
npx wrangler@latest secret put WEBHOOK_VERIFY_TOKEN
npx wrangler@latest secret put MASTER_KEY
npx wrangler@latest secret put N8N_HMAC_SECRET
```

## Migrations e Seed

O schema D1 em `apps/api/schema.sql` inclui:

- 8 secretarias
- 14 filas
- 7 regras de roteamento
- 7 regras de SLA
- tags e tabelas auxiliares

## Meta WhatsApp (Webhook)

### Verificacao do Webhook

URL:
```
https://<worker-url>/webhook/webhook
```

Parametros:
- `hub.mode=subscribe`
- `hub.verify_token=<WEBHOOK_VERIFY_TOKEN>`
- `hub.challenge=<any>`

### Assinatura

Use o header `x-hub-signature-256` e valide com o `app_secret` do Meta.

## n8n

### Events Worker -> n8n

- `inbound_message_received`
- `sla_risk`
- `daily_digest`

Payload assinado via HMAC (`N8N_HMAC_SECRET` ou config no D1).

### Actions n8n -> Worker

Endpoint:
```
POST /webhook-n8n/actions
```

Headers:
- `x-n8n-signature: <HMAC>`

Allowlist configurado na tabela `integrations`.

## Consulta Publica por Protocolo

Endpoint:
```
GET /public/cases/:protocol
```

Retorna somente:
- status
- secretaria
- fila
- updated_at

Rate limit via KV: 60 req/min por IP.

## Runbook (Incidentes)

### Webhook caiu
- Verificar health do Worker
- Verificar assinatura Meta
- Verificar logs do Worker

### Mensagens duplicando
- Verificar dedupe por external_message_id
- Verificar se fila esta reenfileirando

### Falha de envio
- Verificar Meta access_token
- Verificar permissao do numero
- Verificar logs do worker outbound

### SLA estourando
- Verificar filas e rules
- Verificar queue SLA
- Verificar integracao n8n

## Deploy

### API Worker

```bash
cd apps/api
npx wrangler@latest deploy
```

### Admin Pages

```bash
cd apps/web
npm install
npm run build
npx wrangler@latest pages deploy dist --project-name ouvidoria-web
```

## URLs

- API Worker: `https://ouvidoria-digital.fabioservio.workers.dev`
- Admin Pages: `https://ouvidoria-web.pages.dev`

## Observacoes Importantes

- Queues exigem plano pago.
- PDF nao faz parte do MVP.
- Segredos sao criptografados no D1 via MASTER_KEY.
- Rate limit e sempre via KV (nao Turnstile no MVP).
