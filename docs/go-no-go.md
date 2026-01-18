# Go/No-Go

## Sprint A
- Go if: WhatsApp missing_fields correct; case detail returns citizen; citizen edit allowed only for admin/manager/governo; audit logs only fields_changed
- No-Go if: citizen edit allowed for Gabinete/secretaria; audit logs contain PII; missing_fields incorrect for WhatsApp

## Sprint B
- Go if: public intake creates full citizen; E.164 invalid returns 400; consent required; rate limit returns 429
- No-Go if: public intake allows invalid phone; consent bypassable; rate limit not enforced

## Sprint C
- Go if: Instagram cases require name/email/phone; citizen IG identifiers saved
- No-Go if: IG missing_fields wrong; IG citizen conflicts overwrite phone/email
