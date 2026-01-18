# QA Checklist

## Sprint A

QA-A1
- Passos: enviar mensagem inbound WhatsApp sem nome/email
- Esperado: missing_fields = [full_name,email]
- Onde ver: Admin case detail + GET /api/v1/cases/:id

QA-A3
- Passos: PUT /api/v1/citizens/:id com nome/email/telefone
- Esperado: 200, citizen atualizado
- Onde ver: API response + case detail

QA-A4
- Passos: editar citizen e consultar audit
- Esperado: audit logs apenas fields_changed (sem PII)
- Onde ver: GET /api/v1/audit?entity_type=citizen&entity_id=...

QA-A5 (merge seguro)
- Passos: criar citizen WA (wa_id A, phone X), depois web intake com mesmo email e phone diferente
- Esperado: nao sobrescreve telefone; cria novo citizen ou marca conflito
- Onde ver: D1 citizen_profiles + cases.citizen_id

## Sprint B

QA-B2
- Passos: POST /api/v1/public/cases com phone invalid
- Esperado: 400
- Onde ver: API response

QA-B3
- Passos: 11 requests /api/v1/public/cases no mesmo IP em 1h
- Esperado: 429 no 11o
- Onde ver: API response

QA-B5
- Passos: POST /api/v1/public/cases sem consent
- Esperado: 400
- Onde ver: API response

## Sprint C

QA-C1
- Passos: criar case IG simulado com citizen incompleto
- Esperado: missing_fields = [full_name,email,phone_e164]
- Onde ver: GET /api/v1/cases/:id
