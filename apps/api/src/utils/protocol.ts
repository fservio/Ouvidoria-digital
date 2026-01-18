const ENTROPY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PROTOCOL_LENGTH = 12;
const MAX_ATTEMPTS = 10;

export function generateHighEntropyProtocol(): string {
  const bytes = new Uint8Array(PROTOCOL_LENGTH);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((b) => ENTROPY_CHARS[b % ENTROPY_CHARS.length])
    .join('');
}

export function formatProtocol(protocol: string): string {
  return `${protocol.slice(0, 4)}-${protocol.slice(4, 8)}-${protocol.slice(8, 12)}`;
}

export async function isProtocolUnique(db: D1Database, protocol: string): Promise<boolean> {
  const result = await db
    .prepare('SELECT id FROM cases WHERE protocol = ?')
    .bind(protocol)
    .first();
  return !result;
}

export async function generateUniqueProtocol(db: D1Database): Promise<string> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const raw = generateHighEntropyProtocol();
    const formatted = formatProtocol(raw);

    if (await isProtocolUnique(db, formatted)) {
      return formatted;
    }
  }

  throw new Error('Failed to generate unique protocol after max attempts');
}

export function parseProtocol(protocol: string): string {
  return protocol.replace(/-/g, '').toUpperCase();
}

export function isValidProtocolFormat(protocol: string): boolean {
  const cleaned = parseProtocol(protocol);
  if (cleaned.length !== PROTOCOL_LENGTH) return false;
  return /^[A-Z0-9]+$/.test(cleaned);
}
