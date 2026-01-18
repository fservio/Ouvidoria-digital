export async function verifyMetaSignature(payload: string, signature: string, appSecret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureData = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  const expectedSignature = bufferToHex(new Uint8Array(signatureData));
  const provided = signature.replace('sha256=', '');

  return provided === expectedSignature;
}

export function parseWebhookPayload(rawBody: string): object {
  return JSON.parse(rawBody);
}

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
