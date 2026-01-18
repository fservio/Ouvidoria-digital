export async function signN8nPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bufferToHex(new Uint8Array(signature));
}

export async function verifyN8nSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!secret) return false;
  const expected = await signN8nPayload(payload, secret);
  return expected === signature;
}

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
