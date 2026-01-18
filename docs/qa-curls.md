# QA curls

Base URLs:
- API: https://ouvidoria-digital.fabioservio.workers.dev

## Sprint A

### QA-A1 (WhatsApp missing_fields)
```bash
curl -i -H "Authorization: Bearer <JWT>" \
  "https://ouvidoria-digital.fabioservio.workers.dev/api/v1/cases/<CASE_ID>"
```
Expected: `missing_fields` includes `full_name` and `email`.

### QA-A3 (Editar cidadão via API)
```bash
curl -i -X PUT \
  "https://ouvidoria-digital.fabioservio.workers.dev/api/v1/citizens/<CITIZEN_ID>" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Nome Atualizado","email":"usuario@example.com","phone_e164":"+5586999990000"}'
```
Expected: 200, citizen updated.

### QA-A4 (Auditoria sem PII)
```bash
curl -s -H "Authorization: Bearer <JWT>" \
  "https://ouvidoria-digital.fabioservio.workers.dev/api/v1/audit?entity_type=citizen&entity_id=<CITIZEN_ID>"
```
Expected: logs only contain `fields_changed`, no email/phone/name values.

## Sprint B

### QA-B2 (E.164 validation)
```bash
curl -i -X POST \
  "https://ouvidoria-digital.fabioservio.workers.dev/api/v1/public/cases" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Teste","email":"teste@example.com","phone_e164":"8699991234","description":"Teste","consent":true}'
```
Expected: 400.

### QA-B3 (Rate limit 10/h/IP)
```bash
for i in {1..11}; do \
  curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "https://ouvidoria-digital.fabioservio.workers.dev/api/v1/public/cases" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Teste","email":"teste@example.com","phone_e164":"+5586999990000","description":"Teste","consent":true}'; \
done
```
Expected: 429 on 11th request.

### QA-B5 (Consentimento obrigatório)
```bash
curl -i -X POST \
  "https://ouvidoria-digital.fabioservio.workers.dev/api/v1/public/cases" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Teste","email":"teste@example.com","phone_e164":"+5586999990000","description":"Teste"}'
```
Expected: 400.

## Sprint C

### QA-C1 (Missing fields Instagram)
```bash
curl -i -H "Authorization: Bearer <JWT>" \
  "https://ouvidoria-digital.fabioservio.workers.dev/api/v1/cases/<CASE_ID>"
```
Expected: `missing_fields` includes `full_name`, `email`, `phone_e164` for channel=instagram.
