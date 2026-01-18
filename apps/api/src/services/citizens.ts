import type { Env } from '../types/index.js';

export interface CitizenProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_e164: string | null;
  whatsapp_wa_id: string | null;
  instagram_user_id: string | null;
  instagram_username: string | null;
  consent_at: string | null;
  consent_source: string | null;
}

export interface CitizenLookupResult {
  citizen: CitizenProfile;
  conflict: boolean;
}

const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhoneE164(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[()\s-]/g, '');
  if (!normalized.startsWith('+')) {
    return null;
  }
  return PHONE_REGEX.test(normalized) ? normalized : null;
}

export function normalizeEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return EMAIL_REGEX.test(trimmed) ? trimmed : null;
}

export function missingFieldsByChannel(channel: string, citizen: CitizenProfile | null): string[] {
  if (channel === 'web') return [];
  const missing: string[] = [];
  if (!citizen?.full_name) missing.push('full_name');
  if (!citizen?.email) missing.push('email');
  if (channel === 'instagram' && !citizen?.phone_e164) missing.push('phone_e164');
  return missing;
}

export async function findOrCreateCitizenByInstagram(env: Env, instagramUserId: string, instagramUsername: string | null): Promise<CitizenProfile> {
  const existing = await env.DB
    .prepare('SELECT * FROM citizen_profiles WHERE instagram_user_id = ? LIMIT 1')
    .bind(instagramUserId)
    .first();

  if (existing) {
    return existing as unknown as CitizenProfile;
  }

  const id = crypto.randomUUID();
  await env.DB
    .prepare(
      `INSERT INTO citizen_profiles (id, instagram_user_id, instagram_username, consent_source)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, instagramUserId, instagramUsername, 'instagram')
    .run();

  const created = await env.DB
    .prepare('SELECT * FROM citizen_profiles WHERE id = ?')
    .bind(id)
    .first();

  return created as unknown as CitizenProfile;
}

export async function findOrCreateCitizenByWhatsapp(env: Env, waId: string, phoneE164: string | null, fullName: string | null): Promise<CitizenProfile> {
  const existing = await env.DB
    .prepare('SELECT * FROM citizen_profiles WHERE whatsapp_wa_id = ? LIMIT 1')
    .bind(waId)
    .first();

  if (existing) {
    return existing as unknown as CitizenProfile;
  }

  const id = crypto.randomUUID();
  await env.DB
    .prepare(
      `INSERT INTO citizen_profiles (id, full_name, email, phone_e164, whatsapp_wa_id, consent_source)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, fullName, null, phoneE164, waId, 'whatsapp')
    .run();

  const created = await env.DB
    .prepare('SELECT * FROM citizen_profiles WHERE id = ?')
    .bind(id)
    .first();

  return created as unknown as CitizenProfile;
}

export async function findOrCreateCitizenByPhoneEmail(
  env: Env,
  phoneE164: string | null,
  email: string | null,
  fullName: string | null,
  consentSource: string,
  consentAt: string | null
): Promise<CitizenLookupResult> {
  let conflict = false;
  let existing = null as CitizenProfile | null;

  if (phoneE164) {
    const result = await env.DB
      .prepare('SELECT * FROM citizen_profiles WHERE phone_e164 = ? LIMIT 1')
      .bind(phoneE164)
      .first();
    if (result) {
      existing = result as unknown as CitizenProfile;
    }
  }

  if (!existing && email) {
    const result = await env.DB
      .prepare('SELECT * FROM citizen_profiles WHERE email = ? LIMIT 1')
      .bind(email)
      .first();
    if (result) {
      existing = result as unknown as CitizenProfile;
      if (phoneE164 && existing.phone_e164 && existing.phone_e164 !== phoneE164) {
        conflict = true;
        existing = null;
      }
    }
  }

  if (!existing) {
    const id = crypto.randomUUID();
    await env.DB
      .prepare(
        `INSERT INTO citizen_profiles (id, full_name, email, phone_e164, consent_at, consent_source)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, fullName, email, phoneE164, consentAt, consentSource)
      .run();

    const created = await env.DB
      .prepare('SELECT * FROM citizen_profiles WHERE id = ?')
      .bind(id)
      .first();

    return { citizen: created as unknown as CitizenProfile, conflict };
  }

  const updates: Partial<CitizenProfile> = {};
  if (fullName && !existing.full_name) updates.full_name = fullName;
  if (email && !existing.email) updates.email = email;
  if (phoneE164 && !existing.phone_e164) updates.phone_e164 = phoneE164;
  if (consentAt && !existing.consent_at) updates.consent_at = consentAt;
  if (consentSource && !existing.consent_source) updates.consent_source = consentSource;

  if (Object.keys(updates).length > 0) {
    const updated = await updateCitizenFields(env, existing.id, updates);
    return { citizen: updated, conflict };
  }

  return { citizen: existing, conflict };
}

export async function updateCitizenFields(env: Env, citizenId: string, updates: Partial<CitizenProfile>): Promise<CitizenProfile> {
  const setClauses: string[] = [];
  const params: (string | null)[] = [];

  if (updates.full_name !== undefined) {
    setClauses.push('full_name = ?');
    params.push(updates.full_name);
  }
  if (updates.email !== undefined) {
    setClauses.push('email = ?');
    params.push(updates.email);
  }
  if (updates.phone_e164 !== undefined) {
    setClauses.push('phone_e164 = ?');
    params.push(updates.phone_e164);
  }
  if (updates.whatsapp_wa_id !== undefined) {
    setClauses.push('whatsapp_wa_id = ?');
    params.push(updates.whatsapp_wa_id);
  }
  if (updates.instagram_user_id !== undefined) {
    setClauses.push('instagram_user_id = ?');
    params.push(updates.instagram_user_id);
  }
  if (updates.instagram_username !== undefined) {
    setClauses.push('instagram_username = ?');
    params.push(updates.instagram_username);
  }
  if (updates.consent_at !== undefined) {
    setClauses.push('consent_at = ?');
    params.push(updates.consent_at);
  }
  if (updates.consent_source !== undefined) {
    setClauses.push('consent_source = ?');
    params.push(updates.consent_source);
  }

  if (setClauses.length === 0) {
    const existing = await env.DB.prepare('SELECT * FROM citizen_profiles WHERE id = ?').bind(citizenId).first();
    return existing as unknown as CitizenProfile;
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  params.push(citizenId);

  await env.DB.prepare(`UPDATE citizen_profiles SET ${setClauses.join(', ')} WHERE id = ?`).bind(...params).run();

  const updated = await env.DB.prepare('SELECT * FROM citizen_profiles WHERE id = ?').bind(citizenId).first();
  return updated as unknown as CitizenProfile;
}

export async function mirrorCitizenToCase(env: Env, caseId: string, citizen: CitizenProfile): Promise<void> {
  await env.DB
    .prepare('UPDATE cases SET citizen_name = ?, citizen_email = ?, citizen_phone = ? WHERE id = ?')
    .bind(citizen.full_name, citizen.email, citizen.phone_e164 || 'web', caseId)
    .run();
}
