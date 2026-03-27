export const AUTH_SESSION_COOKIE_NAME = '__session';
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface SessionPayload {
  type: 'session';
  exp: number;
}

export interface AuthConfig {
  enabled: boolean;
  configured: boolean;
  secret: string | null;
}

function parseOptionalBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  switch (value.trim().toLowerCase()) {
    case 'true':
    case '1':
      return true;
    case 'false':
    case '0':
      return false;
    default:
      return undefined;
  }
}

function normalizeSecret(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function getAuthConfig(): AuthConfig {
  const secret = normalizeSecret(process.env.AUTH_SECRET);
  const enabledOverride = parseOptionalBooleanEnv(process.env.AUTH_ENABLED);
  const enabled = enabledOverride ?? Boolean(secret);

  return {
    enabled,
    configured: !enabled || secret !== null,
    secret,
  };
}

export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < len; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export function isValidAuthSecret(input: string, expected: string): boolean {
  return constantTimeEqual(input, expected);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function decodePayload(payload: string): SessionPayload | null {
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(payload));
    const parsed = JSON.parse(decoded) as Partial<SessionPayload>;
    if (parsed.type !== 'session' || typeof parsed.exp !== 'number') {
      return null;
    }
    return { type: 'session', exp: parsed.exp };
  } catch {
    return null;
  }
}

export async function createSessionCookieValue(
  secret: string,
  maxAgeSeconds = AUTH_SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    type: 'session',
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  } satisfies SessionPayload)));
  const signature = await signValue(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifySessionCookieValue(
  value: string | undefined | null,
  secret: string,
): Promise<boolean> {
  if (!value) {
    return false;
  }

  const [payload, signature] = value.split('.');
  if (!payload || !signature) {
    return false;
  }

  const key = await importSigningKey(secret);
  const signatureBytes = base64UrlToBytes(signature);
  const isValidSignature = await crypto.subtle.verify(
    'HMAC',
    key,
    new Uint8Array(signatureBytes).buffer,
    new TextEncoder().encode(payload),
  );
  if (!isValidSignature) {
    return false;
  }

  const decodedPayload = decodePayload(payload);
  if (!decodedPayload) {
    return false;
  }

  return decodedPayload.exp > Math.floor(Date.now() / 1000);
}

export function getSessionCookieOptions(maxAgeSeconds = AUTH_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function getExpiredSessionCookieOptions() {
  return {
    ...getSessionCookieOptions(0),
    expires: new Date(0),
  };
}
