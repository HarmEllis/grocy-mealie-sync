/**
 * The MCP surface uses the same validated Shop actions as the browser. Dispatch
 * is a fixed allowlist of in-process handlers; no caller can supply a URL or
 * bypass the domain locks, ledger checks or single-use authentication steps.
 */
type Context = { params: Promise<{ id: string; lineId: string }> };
type Handler = (request: Request, context: Context) => Promise<Response>;
const handlers: Record<string, { method: string; call: Handler }> = {
  'plugins.list': { method: 'GET', call: async () => (await import('@/app/api/plugins/installations/route')).GET() },
  'plugins.create': { method: 'POST', call: async r => (await import('@/app/api/plugins/installations/route')).POST(r) },
  'plugins.update': { method: 'PATCH', call: async (r, c) => (await import('@/app/api/plugins/installations/[id]/route')).PATCH(r, c) },
  'plugins.revoke': { method: 'DELETE', call: async (r, c) => (await import('@/app/api/plugins/installations/[id]/route')).DELETE(r, c) },
  'plugins.rotate_token': { method: 'POST', call: async (r, c) => (await import('@/app/api/plugins/installations/[id]/rotate/route')).POST(r, c) },
  'plugins.reset_binding': { method: 'POST', call: async (r, c) => (await import('@/app/api/plugins/installations/[id]/reset-binding/route')).POST(r, c) },
  'plugins.auth': { method: 'POST', call: async (r, c) => (await import('@/app/api/plugins/installations/[id]/auth/route')).POST(r, c) },
  'plugins.catalog_search': { method: 'GET', call: async (r, c) => (await import('@/app/api/plugins/installations/[id]/catalog/route')).GET(r, c) },
  'shop.overview': { method: 'GET', call: async () => (await import('@/app/api/shop/overview/route')).GET() },
  'shop.mappings.list': { method: 'GET', call: async r => (await import('@/app/api/shop/mappings/route')).GET(r) },
  'shop.mappings.save': { method: 'POST', call: async r => (await import('@/app/api/shop/mappings/route')).POST(r) },
  'shop.mappings.update': { method: 'PATCH', call: async (r, c) => (await import('@/app/api/shop/mappings/[id]/route')).PATCH(r, c) },
  'shop.mappings.delete': { method: 'DELETE', call: async (r, c) => (await import('@/app/api/shop/mappings/[id]/route')).DELETE(r, c) },
  'shop.targets.search': { method: 'GET', call: async r => (await import('@/app/api/shop/targets/route')).GET(r) },
  'shop.suggestions.decide': { method: 'POST', call: async (r, c) => (await import('@/app/api/shop/suggestions/[id]/route')).POST(r, c) },
  'shop.searches.retry': { method: 'POST', call: async (r, c) => (await import('@/app/api/shop/searches/[id]/retry/route')).POST(r, c) },
  'shop.lists.sync': { method: 'POST', call: async () => (await import('@/app/api/shop/run/route')).POST() },
  'shop.receipts.pull': { method: 'POST', call: async r => (await import('@/app/api/shop/receipts/pull/route')).POST(r) },
  'shop.lines.resolve': { method: 'POST', call: async r => (await import('@/app/api/shop/lines/resolve/route')).POST(r) },
  'shop.review.resolve': { method: 'POST', call: async (r, c) => (await import('@/app/api/shop/review/[lineId]/route')).POST(r, c) },
  'shop.effects.resolve': { method: 'POST', call: async (r, c) => (await import('@/app/api/shop/effects/[id]/route')).POST(r, c) },
  'shop.discrepancies.resolve': { method: 'POST', call: async (r, c) => (await import('@/app/api/shop/discrepancies/[id]/route')).POST(r, c) },
};

export interface ShopUiInput { id?: string; query?: Record<string, string>; body?: Record<string, unknown> }
export interface ShopUiResult { ok: boolean; status: number; data: Record<string, unknown> }
export async function invokeShopUiAction(action: string, input: ShopUiInput = {}): Promise<ShopUiResult> {
  const handler = Object.hasOwn(handlers, action) ? handlers[action] : undefined;
  if (!handler) throw new Error('Unsupported Shop action');
  const url = new URL('http://gms.internal/shop-action');
  for (const [key, value] of Object.entries(input.query ?? {})) url.searchParams.set(key, value);
  const request = new Request(url, { method: handler.method,
    ...(handler.method !== 'GET' && handler.method !== 'DELETE' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input.body ?? {}) } : {}),
  });
  const response = await handler.call(request, { params: Promise.resolve({ id: input.id ?? '', lineId: input.id ?? '' }) });
  return { ok: response.ok, status: response.status, data: await response.json() };
}
