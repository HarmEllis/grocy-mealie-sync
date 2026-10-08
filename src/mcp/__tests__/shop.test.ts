import { beforeEach, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
const runtime = vi.hoisted(() => ({ gateway: null as unknown }));
vi.mock('@/lib/db', async () => { const { createTestDb } = await import('@/test-utils/test-db'); return { db: createTestDb() }; });
vi.mock('@/lib/plugins/runtime', () => ({ getPluginGateway: () => runtime.gateway, getShopWorker: () => null }));
import { db } from '@/lib/db';
import { receipts, receiptLines, retailerMappings, retailerProducts, pluginInstallations } from '@/lib/db/schema';
import { recordHello } from '@/lib/plugins/installations';
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
      'plugins.auth_begin', 'plugins.auth_submit', 'plugins.auth_logout', 'plugins.catalog_search',
      'shop.overview', 'shop.mappings.list', 'shop.mappings.save', 'shop.mappings.update', 'shop.mappings.delete', 'shop.targets.search',
      'shop.suggestions.decide', 'shop.searches.retry', 'shop.lists.sync', 'shop.receipts.pull', 'shop.receipts.history', 'shop.mappings.preview',
      'shop.lines.resolve', 'shop.review.resolve', 'shop.effects.resolve', 'shop.discrepancies.resolve',
    ]));
    expect(tools.find(t => t.name === 'plugins.revoke')?.annotations?.destructiveHint).toBe(true);
    expect(tools.find(t => t.name === 'shop.overview')?.annotations?.readOnlyHint).toBe(true);
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
    runtime.gateway = { getSession: () => ({ connectedAt: new Date() }), call: vi.fn(async (_id, method, params) => method === 'receipts.list' ? { receipts: [{ receiptId: 'old', purchasedAt: '2025-01-01T10:00:00Z', lineCount: 1 }], nextCursor: null } : { receiptId: params.receiptId, purchasedAt: '2025-01-01T10:00:00Z', lines: [{ lineNo: 1, kind: 'product', retailerProductId: 'chicken', description: 'Chicken', quantity: 2, unit: 'st' }] }) };
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
