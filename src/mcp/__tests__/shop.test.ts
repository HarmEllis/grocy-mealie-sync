import { beforeEach, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
const runtime = vi.hoisted(() => ({ gateway: null as unknown }));
vi.mock('@/lib/db', async () => { const { createTestDb } = await import('@/test-utils/test-db'); return { db: createTestDb() }; });
vi.mock('@/lib/plugins/runtime', () => ({ getPluginGateway: () => runtime.gateway, getShopWorker: () => null }));
import { db } from '@/lib/db';
import { receipts, receiptLines, retailerMappings, retailerProducts, pluginInstallations } from '@/lib/db/schema';
import { getInstallation, recordHello } from '@/lib/plugins/installations';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { registerShopTools } from '../tools/shop';

beforeEach(() => { db.delete(receiptLines).run(); db.delete(receipts).run(); db.delete(retailerMappings).run(); db.delete(retailerProducts).run(); db.delete(pluginInstallations).run(); runtime.gateway = null; });
async function pair() {
  const server = new McpServer({ name: 'shop-test', version: 'test' });
  registerShopTools(server);
  const client = new Client({ name: 'test', version: 'test' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
function data(result: unknown) {
  return (result as { structuredContent: { data: Record<string, unknown> } }).structuredContent.data;
}

it('exposes every Shop UI action as a discoverable MCP tool', async () => {
  const connection = await pair();
  try {
    const tools = (await connection.client.listTools()).tools;
    expect(tools.map(t => t.name)).toEqual(expect.arrayContaining([
      'plugins.list', 'plugins.create', 'plugins.update', 'plugins.revoke', 'plugins.rotate_token', 'plugins.reset_binding',
      'plugins.auth_begin', 'plugins.auth_submit', 'plugins.auth_logout', 'plugins.catalog_search', 'plugins.catalog_refresh',
      'shop.overview', 'shop.products.list', 'shop.mappings.list', 'shop.mappings.save', 'shop.mappings.update', 'shop.mappings.delete', 'shop.targets.search',
      'shop.suggestions.decide', 'shop.searches.retry', 'shop.lists.sync', 'shop.lists.fallback', 'shop.receipts.pull', 'shop.receipts.history', 'shop.mappings.preview',
      'shop.lines.resolve', 'shop.review.resolve', 'shop.effects.resolve', 'shop.discrepancies.resolve',
    ]));
    expect(tools.find(t => t.name === 'plugins.revoke')?.annotations?.destructiveHint).toBe(true);
    expect(tools.find(t => t.name === 'shop.overview')?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find(t => t.name === 'shop.products.list')?.inputSchema.properties).toHaveProperty('source');
    expect(tools.find(t => t.name === 'plugins.catalog_search')?.inputSchema.properties).toHaveProperty('refresh');
    expect(tools.find(t => t.name === 'shop.lines.resolve')?.inputSchema.properties).toHaveProperty('kind');
    expect(tools.find(t => t.name === 'shop.targets.search')?.inputSchema.properties).toHaveProperty('suggestFor');
  } finally { await connection.close(); }
});

it('creates, reads, renames, rotates and revokes installations through the actual UI validators', async () => {
  const connection = await pair();
  try {
    const created = data(await connection.client.callTool({ name: 'plugins.create', arguments: { name: 'Synthetic shop' } }));
    const id = (created.installation as { id: string }).id;
    expect(created.token).toMatch(/^gmsp_/);
    const listed = await connection.client.callTool({ name: 'plugins.list' });
    expect(JSON.stringify(listed)).not.toContain(created.token);
    const updated = data(await connection.client.callTool({ name: 'plugins.update', arguments: { id, name: 'Renamed shop', settings: { listSyncEnabled: true } } }));
    expect(updated.installation).toMatchObject({ name: 'Renamed shop', settings: { listSyncEnabled: true } });
    const rotated = data(await connection.client.callTool({ name: 'plugins.rotate_token', arguments: { id } }));
    expect(rotated.token).not.toBe(created.token);
    await connection.client.callTool({ name: 'plugins.revoke', arguments: { id } });
    expect(data(await connection.client.callTool({ name: 'plugins.list' })).installations).toEqual([]);
  } finally { await connection.close(); }
});

it('relays safe sign-in failures with their code and outcome while keeping auth values out of storage', async () => {
  const connection = await pair();
  try {
    const created = data(await connection.client.callTool({ name: 'plugins.create', arguments: { name: 'Synthetic shop' } }));
    const id = (created.installation as { id: string }).id;
    const call = vi.fn(async () => { throw Object.assign(new Error('The retailer rejected this code. Start a new login.'), { name: 'PluginCallError', code: 'UNAUTHENTICATED', outcome: 'not_applied', retryable: false }); });
    runtime.gateway = { getSession: () => ({}), call };
    const result = await connection.client.callTool({ name: 'plugins.auth_submit', arguments: { id, stepId: 'step', values: { code: 'synthetic-secret' } } });
    expect(result.isError).toBe(true);
    expect(data(result)).toMatchObject({ code: 'UNAUTHENTICATED', outcome: 'not_applied', error: expect.stringContaining('Start a new login') });
    expect(JSON.stringify(db.select().from(pluginInstallations).all())).not.toContain('synthetic-secret');
    expect(JSON.stringify(result)).not.toContain('synthetic-secret');
  } finally { await connection.close(); }
});

it('returns the same domain error when review or mapping state is missing', async () => {
  const connection = await pair();
  try {
    const result = await connection.client.callTool({ name: 'shop.mappings.update', arguments: { id: 'missing', packageBaseAmount: 250 } });
    expect(result.isError).toBe(true);
    expect(data(result)).toEqual({ error: 'Mapping not found' });
    expect((result.structuredContent as { status: number }).status).toBe(404);
  } finally { await connection.close(); }
});

it('imports reference receipts and configures their products using the same MCP/UI handlers', async () => {
  const connection = await pair();
  try {
    const created = data(await connection.client.callTool({ name: 'plugins.create', arguments: { name: 'History shop' } }));
    const id = (created.installation as { id: string }).id;
    recordHello(id, { pluginName: 'Demo', pluginVersion: '1', providerId: 'demo', providerLabel: 'Demo', accountKey: 'account', accountLabel: 'Account', protocolVersions: [1], capabilities: ['receipts'], authState: 'authenticated' });
    runtime.gateway = { getSession: () => ({ connectedAt: new Date(), hello: { capabilities: ['receipts'] } }), call: vi.fn(async (_id, method, params) => method === 'receipts.list' ? { receipts: [{ receiptId: 'old', purchasedAt: '2025-01-01T10:00:00Z', lineCount: 1 }], nextCursor: null } : { receiptId: params.receiptId, purchasedAt: '2025-01-01T10:00:00Z', lines: [{ lineNo: 1, kind: 'product', retailerProductId: 'chicken', description: 'Chicken', quantity: 2, unit: 'st' }] }) };
    const result = await connection.client.callTool({ name: 'shop.receipts.history', arguments: { installationId: id, limit: 5 } });
    expect(result.isError).not.toBe(true);
    expect(data(result)).toMatchObject({ imported: 1, referenceOnly: true });
    const overview = data(await connection.client.callTool({ name: 'shop.overview', arguments: {} }));
    expect(overview.receipts).toEqual(expect.arrayContaining([expect.objectContaining({ referenceOnly: true, status: 'reference_only', lines: expect.arrayContaining([expect.objectContaining({ retailerProductId: 'chicken', quantity: 2 })]) })]));
    const saved = await connection.client.callTool({ name: 'shop.mappings.save', arguments: { providerId: 'demo', retailerProductId: 'chicken', targetKind: 'mealie_food', targetId: 'food', targetName: 'Chicken', baseUnitId: null, packageBaseAmount: 1, confirm: true } });
    expect(saved.isError).not.toBe(true);
    expect(db.select().from(receipts).all()[0].status).toBe('reference_only');
    const updated = data(await connection.client.callTool({ name: 'shop.overview', arguments: {} }));
    expect(updated.receipts).toEqual(expect.arrayContaining([expect.objectContaining({ lines: expect.arrayContaining([expect.objectContaining({ mapping: expect.objectContaining({ targetName: 'Chicken', confirmed: true }) })]) })]));
  } finally { await connection.close(); }
});

it('resets an authenticated installation through MCP only after the plugin completes sign-out', async () => {
  const connection = await pair();
  try {
    const created = data(await connection.client.callTool({ name: 'plugins.create', arguments: { name: 'Account switch' } }));
    const id = (created.installation as { id: string }).id;
    const hello = { pluginName: 'Demo', pluginVersion: 'test', providerId: 'demo', providerLabel: 'Demo', accountKey: 'old-account', accountLabel: 'Old', protocolVersions: [1], capabilities: ['auth'], authState: 'authenticated' } satisfies Parameters<typeof recordHello>[1];
    recordHello(id, { ...hello, protocolVersions: [1], capabilities: ['auth'] });
    await connection.client.callTool({ name: 'plugins.update', arguments: { id, settings: { listSyncEnabled: true, receiptsEnabled: true } } });
    const call = vi.fn(async () => { throw Object.assign(new Error('Synthetic sign-out failure'), { name: 'PluginCallError', code: 'UPSTREAM_UNAVAILABLE', outcome: 'not_applied', retryable: false }); });
    const closeInstallation = vi.fn();
    runtime.gateway = { getSession: () => ({}), call, closeInstallation };
    expect((await connection.client.callTool({ name: 'plugins.reset_binding', arguments: { id } })).isError).toBe(true);
    expect(getInstallation(id)?.settings.boundAccountKey).toBe('old-account');
    expect(closeInstallation).not.toHaveBeenCalled();
    runtime.gateway = { getSession: () => ({}), call: vi.fn(async () => { throw Object.assign(new Error('Synthetic timeout'), { name: 'PluginCallError', code: 'TIMEOUT', outcome: 'unknown', retryable: true }); }), closeInstallation };
    const timedOut = await connection.client.callTool({ name: 'plugins.reset_binding', arguments: { id } });
    expect(timedOut.isError).toBe(true);
    expect(JSON.stringify(timedOut)).toContain('account binding has been kept');
    expect(getInstallation(id)?.settings.boundAccountKey).toBe('old-account');
    expect(closeInstallation).not.toHaveBeenCalled();
    runtime.gateway = { getSession: () => ({}), call: vi.fn(async () => ({ kind: 'done' })), closeInstallation };
    const reset = await connection.client.callTool({ name: 'plugins.reset_binding', arguments: { id } });
    expect(reset.isError).not.toBe(true);
    expect(getInstallation(id)).toMatchObject({ accountKey: null, authState: 'unauthenticated', settings: { boundAccountKey: null, pinnedListId: null, listSyncEnabled: false, receiptsEnabled: false } });
    expect(closeInstallation).toHaveBeenCalledOnce();
    expect(recordHello(id, { ...hello, accountKey: null, accountLabel: null, authState: 'unauthenticated', protocolVersions: [1], capabilities: ['auth'] }).ok).toBe(true);
    expect(getInstallation(id)?.settings.boundAccountKey).toBeNull();
    expect(recordHello(id, { ...hello, accountKey: 'new-account', protocolVersions: [1], capabilities: ['auth'] }).ok).toBe(true);
    expect(getInstallation(id)?.settings.boundAccountKey).toBe('new-account');
  } finally { await connection.close(); }
});

it('recovers a refused account hello through an offline MCP binding reset', async () => {
  const connection = await pair();
  try {
    const created = data(await connection.client.callTool({ name: 'plugins.create', arguments: { name: 'Offline switch' } }));
    const id = (created.installation as { id: string }).id;
    const hello: Parameters<typeof recordHello>[1] = { pluginName: 'Demo', pluginVersion: 'test', providerId: 'demo', providerLabel: 'Demo', accountKey: 'old-account', accountLabel: 'Old', protocolVersions: [1], capabilities: ['auth'], authState: 'authenticated' };
    recordHello(id, hello);
    expect(recordHello(id, { ...hello, accountKey: 'new-account' }).ok).toBe(false);
    const reset = await connection.client.callTool({ name: 'plugins.reset_binding', arguments: { id } });
    expect(reset.isError).not.toBe(true);
    expect(data(reset)).toMatchObject({ signedOut: false, warning: expect.stringContaining('disconnected') });
    expect(recordHello(id, { ...hello, accountKey: 'new-account' }).ok).toBe(true);
    expect(getInstallation(id)?.settings.boundAccountKey).toBe('new-account');
  } finally { await connection.close(); }
});

it('serializes auth for one plugin without blocking another plugin or regular sync', async () => {
  const connection = await pair();
  let finish: (() => void) | undefined;
  try {
    const first = data(await connection.client.callTool({ name: 'plugins.create', arguments: { name: 'First' } }));
    const second = data(await connection.client.callTool({ name: 'plugins.create', arguments: { name: 'Second' } }));
    const id = (first.installation as { id: string }).id;
    const other = (second.installation as { id: string }).id;
    let started!: () => void;
    const fetching = new Promise<void>(resolve => { started = resolve; });
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    runtime.gateway = { getSession: () => ({}), call: async (installationId: string) => {
      if (installationId === id) { started(); await waiting; }
      return { stepId: 'synthetic', kind: 'done', title: 'Done' };
    } };
    const pending = connection.client.callTool({ name: 'plugins.auth_begin', arguments: { id } });
    await fetching;
    expect(acquireSyncLock()).toBe(true);
    const conflict = await connection.client.callTool({ name: 'plugins.auth_logout', arguments: { id } });
    expect(conflict.isError).toBe(true);
    expect(JSON.stringify(conflict)).toContain('account action is already running');
    const independent = await connection.client.callTool({ name: 'plugins.auth_begin', arguments: { id: other } });
    expect(independent.isError).not.toBe(true);
    releaseSyncLock();
    finish!();
    expect((await pending).isError).not.toBe(true);
  } finally { finish?.(); releaseSyncLock(); await connection.close(); }
});

it('searches and refreshes retailer availability through MCP without changing mappings or demand', async () => {
  const connection = await pair();
  try {
    const created = data(await connection.client.callTool({ name: 'plugins.create', arguments: { name: 'Catalogue test' } }));
    const id = (created.installation as { id: string }).id;
    const hello = { pluginName: 'Demo', pluginVersion: 'test', providerId: 'demo', providerLabel: 'Demo', accountKey: 'account', accountLabel: 'Account', protocolVersions: [1], capabilities: ['catalog'], authState: 'authenticated' } satisfies Parameters<typeof recordHello>[1];
    recordHello(id, hello);
    const call = vi.fn(async (_id: string, method: string) => ({ products: [{ id: 'chicken', name: 'Chicken', measure: 'unit', packageAmount: 500, packageUnit: 'g', availability: method === 'catalog.get' ? 'discontinued' : 'available' }] }));
    runtime.gateway = { getSession: () => ({ hello, connectedAt: new Date() }), call };
    const search = data(await connection.client.callTool({ name: 'plugins.catalog_search', arguments: { id, query: 'Chicken', refresh: true } }));
    expect(search).toMatchObject({ status: 'live', products: [{ id: 'chicken', availability: 'available' }] });
    const refresh = await connection.client.callTool({ name: 'plugins.catalog_refresh', arguments: { id, ids: ['chicken'] } });
    expect(refresh.isError).not.toBe(true);
    expect(call).toHaveBeenCalledWith(id, 'catalog.get', { ids: ['chicken'] }, expect.anything());
    const mappings = data(await connection.client.callTool({ name: 'shop.mappings.list', arguments: { providerId: 'demo' } }));
    expect(mappings).toMatchObject({ products: [{ externalId: 'chicken', availability: 'discontinued' }], mappings: [] });
  } finally { await connection.close(); }
});

it('configures and reads account-scoped text fallback through the actual MCP/UI action', async () => {
  const connection = await pair();
  try {
    const created = data(await connection.client.callTool({ name: 'plugins.create', arguments: { name: 'Text fallback test' } }));
    const id = (created.installation as { id: string }).id;
    recordHello(id, { pluginName: 'Demo', pluginVersion: 'test', providerId: 'demo', providerLabel: 'Demo', accountKey: 'account-for-notes', accountLabel: 'Account', protocolVersions: [1], capabilities: ['list'], features: ['list.notes'], authState: 'authenticated' });
    db.insert(retailerMappings).values({ id: 'note-main', providerId: 'demo', retailerProductId: 'chicken', retailerProductName: 'Chicken', targetKind: 'mealie_food', targetId: 'food', targetName: 'Kipfilet', role: 'preferred', packageBaseAmount: 500, packageBaseUnitName: 'gram', confirmed: true, createdAt: new Date(), updatedAt: new Date() }).run();
    const result = await connection.client.callTool({ name: 'shop.lists.fallback', arguments: { installationId: id, retailerProductId: 'chicken', mode: 'note' } });
    expect(result.isError).not.toBe(true);
    expect(data(result)).toMatchObject({ mode: 'note', manualNoteProductIds: ['chicken'] });
    const read = data(await connection.client.callTool({ name: 'plugins.list', arguments: {} }));
    expect(read.installations).toEqual(expect.arrayContaining([expect.objectContaining({ id, features: ['list.notes'], manualNoteProductIds: ['chicken'] })]));
    expect(db.select().from(retailerMappings).get()).toMatchObject({ packageBaseAmount: 500, confirmed: true, role: 'preferred' });
    expect((await connection.client.callTool({ name: 'shop.lists.fallback', arguments: { installationId: id, retailerProductId: 'missing', mode: 'note' } })).isError).toBe(true);
    expect((await connection.client.callTool({ name: 'shop.lists.fallback', arguments: { installationId: id, retailerProductId: 'chicken', mode: 'product' } })).isError).not.toBe(true);
    expect(data(await connection.client.callTool({ name: 'plugins.list', arguments: {} })).installations).toEqual(expect.arrayContaining([expect.objectContaining({ id, manualNoteProductIds: [] })]));
  } finally { await connection.close(); }
});
