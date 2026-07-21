const IV_BYTES = 12

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array | null {
  try {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

let keyCache: { secret: string; key: CryptoKey } | null = null

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  if (keyCache?.secret === secret) return keyCache.key
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
  keyCache = { secret, key }
  return key
}

export async function sealPayload(
  data: Record<string, unknown>,
  secret: string,
  maxAgeSeconds?: number,
): Promise<string> {
  const payload: { data: Record<string, unknown>; exp?: number } = { data }
  if (maxAgeSeconds != null) {
    payload.exp = Math.floor(Date.now() / 1000) + maxAgeSeconds
  }
  const plain = new TextEncoder().encode(JSON.stringify(payload))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveAesKey(secret)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(cipher))}`
}

export async function unsealPayload(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const dot = token.indexOf('.')
  if (dot === -1) return null
  const iv = base64UrlDecode(token.slice(0, dot))
  const cipher = base64UrlDecode(token.slice(dot + 1))
  if (!iv || !cipher) return null
  try {
    const key = await deriveAesKey(secret)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as {
      data?: Record<string, unknown>
      exp?: number
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
      return null
    }
    if (parsed.exp != null && parsed.exp < Math.floor(Date.now() / 1000)) return null
    return parsed.data as Record<string, unknown>
  } catch {
    return null
  }
}
