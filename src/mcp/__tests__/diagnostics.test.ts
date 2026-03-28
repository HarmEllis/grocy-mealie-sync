import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ProductStateExplanation } from '@/lib/use-cases/diagnostics/explain';
import type { OpenMappingConflictsResource } from '@/lib/use-cases/resources/read-models';
import { createMcpHttpHandler } from '../http';

describe('MCP diagnostics and conflict tools', () => {
  const listOpenMappingConflictsResource = vi.fn(async (): Promise<OpenMappingConflictsResource> => ({
    count: 1,
    conflicts: [
      {
        id: 'conflict-1',
        conflictKey: 'product:food-1:grocy-101',
        type: 'missing-unit-mapping',
        status: 'open',
        severity: 'warning',
        mappingKind: 'product',
        mappingId: 'map-1',
        sourceTab: 'products',
        mealieId: 'food-1',
        mealieName: 'Whole Milk',
        grocyId: 101,
        grocyName: 'Milk',
        summary: 'Product mapping references a missing unit mapping.',
        occurrences: 2,
        firstSeenAt: new Date('2026-03-28T09:00:00.000Z'),
        lastSeenAt: new Date('2026-03-28T10:00:00.000Z'),
        resolvedAt: null,
      },
    ],
  }));

  const explainProductState = vi.fn(async (): Promise<ProductStateExplanation> => ({
    productRef: 'mapping:map-1',
    summary: 'The product is mapped, currently below minimum stock in Grocy, and has 1 open mapping conflict.',
    mappingStatus: 'mapped',
    stockStatus: {
      currentStock: 1,
      minStockAmount: 2,
      isBelowMinimum: true,
      treatOpenedAsOutOfStock: true,
    },
    openConflicts: [
      {
        id: 'conflict-1',
        summary: 'Product mapping references a missing unit mapping.',
        severity: 'warning',
      },
    ],
    notes: [
      'Grocy currently reports this product below minimum stock.',
      'Opened stock is configured to count as out of stock in Grocy.',
    ],
  }));

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('serves diagnostics and conflict list tools', async () => {
    const handleRequest = createMcpHttpHandler({
      resources: {
        listOpenMappingConflictsResource,
      },
      diagnostics: {
        explainProductState,
      },
      conflicts: {
        listOpenMappingConflictsResource,
      },
    });

    const client = new Client(
      { name: 'mcp-diagnostics-test-client', version: '1.0.0' },
      { capabilities: {} },
    );

    const transport = new StreamableHTTPClientTransport(
      new URL('http://localhost/api/mcp'),
      {
        fetch: async (input, init) => handleRequest(
          input instanceof Request ? input : new Request(input, init),
        ),
      },
    );

    try {
      await client.connect(transport);

      const tools = await client.listTools();
      expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
        'conflicts.list',
        'diagnostics.explain_product_state',
      ]));

      const conflictsResult = await client.callTool({
        name: 'conflicts.list',
        arguments: {},
      });
      const diagnosticsResult = await client.callTool({
        name: 'diagnostics.explain_product_state',
        arguments: { productRef: 'mapping:map-1' },
      });

      expect(conflictsResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Found 1 open mapping conflict.',
        data: {
          count: 1,
          conflicts: [
            {
              id: 'conflict-1',
              conflictKey: 'product:food-1:grocy-101',
              type: 'missing-unit-mapping',
              status: 'open',
              severity: 'warning',
              mappingKind: 'product',
              mappingId: 'map-1',
              sourceTab: 'products',
              mealieId: 'food-1',
              mealieName: 'Whole Milk',
              grocyId: 101,
              grocyName: 'Milk',
              summary: 'Product mapping references a missing unit mapping.',
              occurrences: 2,
              firstSeenAt: '2026-03-28T09:00:00.000Z',
              lastSeenAt: '2026-03-28T10:00:00.000Z',
              resolvedAt: null,
            },
          ],
        },
      });
      expect(diagnosticsResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Explained the current product state.',
        data: {
          productRef: 'mapping:map-1',
          summary: 'The product is mapped, currently below minimum stock in Grocy, and has 1 open mapping conflict.',
          mappingStatus: 'mapped',
          stockStatus: {
            currentStock: 1,
            minStockAmount: 2,
            isBelowMinimum: true,
            treatOpenedAsOutOfStock: true,
          },
          openConflicts: [
            {
              id: 'conflict-1',
              summary: 'Product mapping references a missing unit mapping.',
              severity: 'warning',
            },
          ],
          notes: [
            'Grocy currently reports this product below minimum stock.',
            'Opened stock is configured to count as out of stock in Grocy.',
          ],
        },
      });
    } finally {
      await Promise.allSettled([client.close(), transport.close()]);
    }
  });
});
