# D1 migration plan

## Pre-check
- Backup D1 production
- `PRAGMA table_info(cases);`
- `SELECT name FROM sqlite_master WHERE type='table' AND name='citizen_profiles';`

## Apply (staging then prod)
1) Create `citizen_profiles` + indexes
2) `ALTER TABLE cases ADD COLUMN citizen_id TEXT;`
3) `ALTER TABLE cases ADD COLUMN channel TEXT DEFAULT 'whatsapp';`
4) `UPDATE cases SET channel='whatsapp' WHERE channel IS NULL;`

## Post-check
- `PRAGMA table_info(cases);` (verify citizen_id + channel)
- `SELECT channel, COUNT(*) FROM cases GROUP BY channel;`
- `SELECT COUNT(*) FROM citizen_profiles;`

## Rollback
- Revert API to previous deploy
- Set env flags:
  - `PUBLIC_INTAKE_ENABLED=false`
  - `CITIZEN_EDIT_ENABLED=false`
- Keep columns in place (no destructive drops)
