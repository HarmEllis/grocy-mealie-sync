import { expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerHistoryTools } from '../tools/history';

it('passes product-level activity filters, dates and pagination to the same history read model', async () => {
  const read = vi.fn(async () => ({ count: 0, entries: [], offset: 20, hasMore: false }));
  const server = new McpServer({ name: 'history-test', version: 'test' });
  registerHistoryTools(server, { listRecentHistoryResource: vi.fn(), getHistoryRunResource: vi.fn(), listHistoryActivityResource: read });
  const client = new Client({ name: 'test', version: 'test' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    await client.callTool({ name: 'history.list_activity', arguments: { search: 'Cherry tomaten', action: 'shop_list_sync', kind: 'mutation', limit: 20, offset: 20, dateFrom: '2026-10-07', dateTo: '2026-10-07', status: 'success' } });
    expect(read).toHaveBeenCalledWith({ search: 'Cherry tomaten', action: 'shop_list_sync', kind: 'mutation', limit: 20, offset: 20, status: 'success', dateFrom: new Date('2026-10-07T00:00:00'), dateTo: new Date('2026-10-07T23:59:59.999') });
  } finally { await client.close(); await server.close(); }
});
