export class ShopRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ShopRequestError';
  }
}

/** JSON fetch for the shop UI; throws with the server's error message. */
export async function apiJson<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `Request failed (${response.status})`;
    const code = (body as { code?: unknown } | null)?.code;
    throw new ShopRequestError(message, response.status, typeof code === 'string' ? code : undefined);
  }
  return body as T;
}
