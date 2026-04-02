import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type {
  ProductDuplicateCheckResult,
  ProductOverview,
  ProductSearchResult,
} from '@/lib/use-cases/products/catalog';
import { createGrocyMealieSyncMcpServer } from '../server';

describe('MCP server contract', () => {
  const searchProducts = vi.fn(async (): Promise<ProductSearchResult> => ({
    query: 'milk',
    matches: [
      {
        productRef: 'mapping:map-1',
        source: 'mapping',
        score: 100,
        label: 'Whole Milk <-> Milk',
        mappingId: 'map-1',
        mealieFoodId: 'food-1',
        mealieFoodName: 'Whole Milk',
        grocyProductId: 101,
        grocyProductName: 'Milk',
      },
    ],
  }));

  const getProductOverview = vi.fn(async (): Promise<ProductOverview> => ({
    productRef: 'mapping:map-1',
    mapping: {
      id: 'map-1',
      mealieFoodId: 'food-1',
      mealieFoodName: 'Whole Milk',
      grocyProductId: 101,
      grocyProductName: 'Milk',
      unitMappingId: 'unit-map-1',
    },
    grocyProduct: {
      id: 101,
      name: 'Milk',
      quIdPurchase: 10,
      quIdPurchaseName: null,
      quIdStock: 10,
      quIdStockName: null,
      currentStock: 1,
      isBelowMinimum: true,
      minStockAmount: 2,
      treatOpenedAsOutOfStock: true,
      defaultBestBeforeDays: 7,
      defaultBestBeforeDaysAfterOpen: 3,
      defaultBestBeforeDaysAfterFreezing: 14,
      defaultBestBeforeDaysAfterThawing: 2,
      dueType: 'expiration',
      shouldNotBeFrozen: false,
      locationId: null,
      locationName: null,
      productGroupId: null,
      productGroupName: null,
    },
    mealieFood: {
      id: 'food-1',
      name: 'Whole Milk',
      pluralName: 'Whole Milks',
      aliases: ['Milk'],
    },
    conversions: [],
  }));

  const checkProductDuplicates = vi.fn(async (): Promise<ProductDuplicateCheckResult> => ({
    query: 'milk',
    likelyDuplicates: true,
    exactGrocyMatches: [],
    exactMealieMatches: [],
    fuzzyGrocyMatches: [],
    fuzzyMealieMatches: [],
  }));

  async function createConnectedPair() {
    const server = createGrocyMealieSyncMcpServer({
      products: {
        searchProducts,
        getProductOverview,
        checkProductDuplicates,
      },
    });

    const client = new Client(
      { name: 'mcp-test-client', version: '1.0.0' },
      { capabilities: {} },
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    return { server, client };
  }

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it('registers the product tools and serves the product overview resource', async () => {
    const { server, client } = await createConnectedPair();

    try {
      const tools = await client.listTools();
      expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
        'products.search',
        'products.get_overview',
        'products.check_duplicates',
      ]));

      const searchResult = await client.callTool({
        name: 'products.search',
        arguments: { query: 'milk' },
      });

      expect(searchProducts).toHaveBeenCalledWith({ query: 'milk', maxResults: 10 });
      expect(searchResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Found 1 product match.',
        data: {
          query: 'milk',
          matches: [
            {
              productRef: 'mapping:map-1',
              source: 'mapping',
              score: 100,
              label: 'Whole Milk <-> Milk',
              mappingId: 'map-1',
              mealieFoodId: 'food-1',
              mealieFoodName: 'Whole Milk',
              grocyProductId: 101,
              grocyProductName: 'Milk',
            },
          ],
        },
      });

      const resource = await client.readResource({
        uri: 'gms://products/mapping:map-1',
      });
      const firstContent = resource.contents[0];

      expect(getProductOverview).toHaveBeenCalledWith({ productRef: 'mapping:map-1' });
      expect(firstContent).toBeDefined();
      expect(firstContent && 'text' in firstContent ? JSON.parse(firstContent.text) : null).toEqual({
        productRef: 'mapping:map-1',
        mapping: {
          id: 'map-1',
          mealieFoodId: 'food-1',
          mealieFoodName: 'Whole Milk',
          grocyProductId: 101,
          grocyProductName: 'Milk',
          unitMappingId: 'unit-map-1',
        },
        grocyProduct: {
          id: 101,
          name: 'Milk',
          quIdPurchase: 10,
          quIdPurchaseName: null,
          quIdStock: 10,
          quIdStockName: null,
          currentStock: 1,
          isBelowMinimum: true,
          minStockAmount: 2,
          treatOpenedAsOutOfStock: true,
          defaultBestBeforeDays: 7,
          defaultBestBeforeDaysAfterOpen: 3,
          defaultBestBeforeDaysAfterFreezing: 14,
          defaultBestBeforeDaysAfterThawing: 2,
          dueType: 'expiration',
          shouldNotBeFrozen: false,
          locationId: null,
          locationName: null,
          productGroupId: null,
          productGroupName: null,
        },
        mealieFood: {
          id: 'food-1',
          name: 'Whole Milk',
          pluralName: 'Whole Milks',
          aliases: ['Milk'],
        },
        conversions: [],
      });
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });
});
