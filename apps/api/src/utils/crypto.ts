const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

interface EncryptedData {
  iv: string;
  tag: string;
  data: string;
}

export async function encryptSecret(plaintext: string, masterKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(masterKey);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    encoder.encode(plaintext)
  );

  const encryptedArray = new Uint8Array(encrypted);
  const tagStart = encryptedArray.length - TAG_LENGTH;
  const tag = encryptedArray.slice(tagStart);
  const data = encryptedArray.slice(0, tagStart);

  const payload: EncryptedData = {
    iv: bufferToHex(iv),
    tag: bufferToHex(tag),
    data: bufferToHex(data),
  };

  return JSON.stringify(payload);
}

export async function decryptSecret(encryptedData: string, masterKey: string): Promise<string> {
  const payload: EncryptedData = JSON.parse(encryptedData);
  const iv = hexToBuffer(payload.iv);
  const tag = hexToBuffer(payload.tag);
  const data = hexToBuffer(payload.data);

  const key = await deriveKey(masterKey);

  const combined = new Uint8Array(data.length + tag.length);
  combined.set(data);
  combined.set(tag, data.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

async function deriveKey(masterKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('ouvidoria-digital-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function generateSecureToken(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bufferToHex(bytes);
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordBytes = encoder.encode(password);

  const key = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const hashed = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign']
  );

  const hashBytes = await crypto.subtle.exportKey('raw', hashed);
  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(new Uint8Array(hashBytes as ArrayBuffer));

  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  const salt = hexToBuffer(saltHex);
  const expectedHash = hexToBuffer(hashHex);

  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const key = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const hashed = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign']
  );

  const hashBytes = await crypto.subtle.exportKey('raw', hashed);
  const actualHash = new Uint8Array(hashBytes as ArrayBuffer);

  return bufferToHex(actualHash) === hashHex;
}
