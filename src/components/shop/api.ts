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
    throw new Error(message);
  }
  return body as T;
}
