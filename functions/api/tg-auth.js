export async function verifyTelegramAuth(authData, botToken) {
  const { hash, ...fields } = authData;

  const keys = Object.keys(fields).sort();
  const dataCheckString = keys.map(k => `${k}=${fields[k]}`).join('\n');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(botToken),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(dataCheckString));

  const hashArray = Array.from(new Uint8Array(sig));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return computedHash === hash;
}
