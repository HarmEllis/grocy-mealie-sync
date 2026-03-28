import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  ProductDuplicateCheckResult,
  ProductOverview,
  ProductSearchResult,
} from '@/lib/use-cases/products/catalog';
import type {
  McpStatusResource,
  OpenMappingConflictsResource,
  ProductMappingsResource,
  UnitMappingsResource,
  UnmappedProductsResource,
  UnmappedUnitsResource,
} from '@/lib/use-cases/resources/read-models';
import type {
  AddShoppingListItemResult,
  CheckShoppingListProductResult,
  RemoveShoppingListItemResult,
  ShoppingListItemsResource,
} from '@/lib/use-cases/shopping/list';
import { createMcpHttpHandler } from '../http';

describe('MCP streamable HTTP handler', () => {
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
      quIdStock: 10,
      currentStock: 1,
      isBelowMinimum: true,
      minStockAmount: 2,
      treatOpenedAsOutOfStock: true,
      defaultBestBeforeDays: 7,
      defaultBestBeforeDaysAfterOpen: 3,
      shouldNotBeFrozen: false,
    },
    mealieFood: {
      id: 'food-1',
      name: 'Whole Milk',
      pluralName: 'Whole Milks',
      aliases: ['Milk'],
    },
  }));

  const checkProductDuplicates = vi.fn(async (): Promise<ProductDuplicateCheckResult> => ({
    query: 'milk',
    likelyDuplicates: true,
    exactGrocyMatches: [],
    exactMealieMatches: [],
    fuzzyGrocyMatches: [],
    fuzzyMealieMatches: [],
  }));

  const getStatusResource = vi.fn(async (): Promise<McpStatusResource> => ({
    lastGrocyPoll: new Date('2026-03-28T18:00:00.000Z'),
    lastMealiePoll: new Date('2026-03-28T18:05:00.000Z'),
    grocyBelowMinStockCount: 2,
    mealieTrackedItemsCount: 5,
    productMappings: 11,
    unitMappings: 7,
  }));

  const listProductMappingsResource = vi.fn(async (): Promise<ProductMappingsResource> => ({
    count: 1,
    mappings: [
      {
        id: 'map-1',
        mealieFoodId: 'food-1',
        mealieFoodName: 'Whole Milk',
        grocyProductId: 101,
        grocyProductName: 'Milk',
        unitMappingId: 'unit-map-1',
        createdAt: new Date('2026-03-28T10:00:00.000Z'),
        updatedAt: new Date('2026-03-28T10:05:00.000Z'),
      },
    ],
  }));

  const listUnitMappingsResource = vi.fn(async (): Promise<UnitMappingsResource> => ({
    count: 1,
    mappings: [
      {
        id: 'unit-map-1',
        mealieUnitId: 'unit-1',
        mealieUnitName: 'Liter',
        mealieUnitAbbreviation: 'l',
        grocyUnitId: 10,
        grocyUnitName: 'Litre',
        conversionFactor: 1,
        createdAt: new Date('2026-03-28T10:00:00.000Z'),
        updatedAt: new Date('2026-03-28T10:05:00.000Z'),
      },
    ],
  }));

  const listUnmappedProductsResource = vi.fn(async (): Promise<UnmappedProductsResource> => ({
    counts: {
      grocyProducts: 1,
      mealieFoods: 1,
    },
    grocyProducts: [
      {
        id: 202,
        name: 'Yoghurt',
        quIdPurchase: 10,
        minStockAmount: 2,
        currentStock: 1,
        isBelowMinimum: true,
      },
    ],
    mealieFoods: [
      {
        id: 'food-2',
        name: 'Greek Yogurt',
      },
    ],
  }));

  const listUnmappedUnitsResource = vi.fn(async (): Promise<UnmappedUnitsResource> => ({
    counts: {
      grocyUnits: 1,
      mealieUnits: 1,
    },
    grocyUnits: [
      {
        id: 20,
        name: 'Pack',
      },
    ],
    mealieUnits: [
      {
        id: 'unit-2',
        name: 'Packet',
        abbreviation: 'pkt',
      },
    ],
  }));

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

  const getShoppingListItemsResource = vi.fn(async (): Promise<ShoppingListItemsResource> => ({
    shoppingListId: 'list-1',
    configured: true,
    counts: {
      total: 2,
      unchecked: 1,
      checked: 1,
    },
    items: [
      {
        id: 'item-1',
        shoppingListId: 'list-1',
        foodId: 'food-1',
        foodName: 'Milk',
        unitId: 'unit-1',
        unitName: 'Liter',
        quantity: 2,
        checked: false,
        note: null,
        display: 'Milk',
        createdAt: '2026-03-29T09:00:00.000Z',
        updatedAt: '2026-03-29T09:05:00.000Z',
      },
      {
        id: 'item-2',
        shoppingListId: 'list-1',
        foodId: 'food-2',
        foodName: 'Bread',
        unitId: null,
        unitName: null,
        quantity: 1,
        checked: true,
        note: null,
        display: 'Bread',
        createdAt: '2026-03-29T08:00:00.000Z',
        updatedAt: '2026-03-29T08:30:00.000Z',
      },
    ],
  }));

  const checkShoppingListProduct = vi.fn(async (): Promise<CheckShoppingListProductResult> => ({
    shoppingListId: 'list-1',
    alreadyOnList: true,
    matchCount: 1,
    matches: [
      {
        id: 'item-1',
        shoppingListId: 'list-1',
        foodId: 'food-1',
        foodName: 'Milk',
        unitId: 'unit-1',
        unitName: 'Liter',
        quantity: 2,
        checked: false,
        note: null,
        display: 'Milk',
        createdAt: '2026-03-29T09:00:00.000Z',
        updatedAt: '2026-03-29T09:05:00.000Z',
        score: 100,
      },
    ],
  }));

  const addShoppingListItem = vi.fn(async (): Promise<AddShoppingListItemResult> => ({
    action: 'created',
    merged: false,
    item: {
      id: 'item-3',
      shoppingListId: 'list-1',
      foodId: 'food-3',
      foodName: 'Eggs',
      unitId: null,
      unitName: null,
      quantity: 2,
      checked: false,
      note: null,
      display: 'Eggs',
      createdAt: '2026-03-29T10:00:00.000Z',
      updatedAt: '2026-03-29T10:00:00.000Z',
    },
  }));

  const removeShoppingListItem = vi.fn(async (): Promise<RemoveShoppingListItemResult> => ({
    removed: true,
    itemId: 'item-1',
  }));

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('serves MCP tools and resources over streamable HTTP', async () => {
    const handleRequest = createMcpHttpHandler({
      products: {
        searchProducts,
        getProductOverview,
        checkProductDuplicates,
      },
      resources: {
        getStatusResource,
        listProductMappingsResource,
        listUnitMappingsResource,
        listUnmappedProductsResource,
        listUnmappedUnitsResource,
        listOpenMappingConflictsResource,
        getShoppingListItemsResource,
      },
      shopping: {
        getShoppingListItemsResource,
        checkShoppingListProduct,
        addShoppingListItem,
        removeShoppingListItem,
      },
    });

    const client = new Client(
      { name: 'mcp-http-test-client', version: '1.0.0' },
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

      const [tools, resources, templates] = await Promise.all([
        client.listTools(),
        client.listResources(),
        client.listResourceTemplates(),
      ]);

      expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
        'products.search',
        'products.get_overview',
        'products.check_duplicates',
        'shopping.list_items',
        'shopping.check_product',
        'shopping.add_item',
        'shopping.remove_item',
      ]));
      expect(resources.resources.map(resource => resource.uri)).toEqual(expect.arrayContaining([
        'gms://status',
        'gms://mappings/products',
        'gms://mappings/units',
        'gms://products/unmapped',
        'gms://units/unmapped',
        'gms://conflicts/open',
        'gms://shopping/items',
      ]));
      expect(templates.resourceTemplates.map(template => template.uriTemplate)).toEqual(expect.arrayContaining([
        'gms://products/{productRef}',
      ]));

      const searchResult = await client.callTool({
        name: 'products.search',
        arguments: { query: 'milk' },
      });

      const shoppingCheckResult = await client.callTool({
        name: 'shopping.check_product',
        arguments: { foodId: 'food-1' },
      });

      const shoppingAddResult = await client.callTool({
        name: 'shopping.add_item',
        arguments: { foodId: 'food-3', quantity: 2 },
      });

      const shoppingRemoveResult = await client.callTool({
        name: 'shopping.remove_item',
        arguments: { itemId: 'item-1' },
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
      expect(checkShoppingListProduct).toHaveBeenCalledWith({
        foodId: 'food-1',
        query: undefined,
        includeChecked: false,
        maxResults: 10,
      });
      expect(shoppingCheckResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Found 1 matching shopping list item.',
        data: {
          shoppingListId: 'list-1',
          alreadyOnList: true,
          matchCount: 1,
          matches: [
            {
              id: 'item-1',
              shoppingListId: 'list-1',
              foodId: 'food-1',
              foodName: 'Milk',
              unitId: 'unit-1',
              unitName: 'Liter',
              quantity: 2,
              checked: false,
              note: null,
              display: 'Milk',
              createdAt: '2026-03-29T09:00:00.000Z',
              updatedAt: '2026-03-29T09:05:00.000Z',
              score: 100,
            },
          ],
        },
      });
      expect(addShoppingListItem).toHaveBeenCalledWith({
        foodId: 'food-3',
        quantity: 2,
        unitId: undefined,
        note: undefined,
        mergeIfExists: true,
      });
      expect(shoppingAddResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Added a new shopping list item.',
        data: {
          action: 'created',
          merged: false,
          item: {
            id: 'item-3',
            shoppingListId: 'list-1',
            foodId: 'food-3',
            foodName: 'Eggs',
            unitId: null,
            unitName: null,
            quantity: 2,
            checked: false,
            note: null,
            display: 'Eggs',
            createdAt: '2026-03-29T10:00:00.000Z',
            updatedAt: '2026-03-29T10:00:00.000Z',
          },
        },
      });
      expect(removeShoppingListItem).toHaveBeenCalledWith({ itemId: 'item-1' });
      expect(shoppingRemoveResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Removed the shopping list item.',
        data: {
          removed: true,
          itemId: 'item-1',
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
          quIdStock: 10,
          currentStock: 1,
          isBelowMinimum: true,
          minStockAmount: 2,
          treatOpenedAsOutOfStock: true,
          defaultBestBeforeDays: 7,
          defaultBestBeforeDaysAfterOpen: 3,
          shouldNotBeFrozen: false,
        },
        mealieFood: {
          id: 'food-1',
          name: 'Whole Milk',
          pluralName: 'Whole Milks',
          aliases: ['Milk'],
        },
      });

      const statusResource = await client.readResource({ uri: 'gms://status' });
      const statusContent = statusResource.contents[0];
      expect(statusContent).toBeDefined();
      expect(getStatusResource).toHaveBeenCalledTimes(1);
      expect(statusContent && 'text' in statusContent ? JSON.parse(statusContent.text) : null).toEqual({
        lastGrocyPoll: '2026-03-28T18:00:00.000Z',
        lastMealiePoll: '2026-03-28T18:05:00.000Z',
        grocyBelowMinStockCount: 2,
        mealieTrackedItemsCount: 5,
        productMappings: 11,
        unitMappings: 7,
      });

      const productMappingsResource = await client.readResource({ uri: 'gms://mappings/products' });
      const productMappingsContent = productMappingsResource.contents[0];
      expect(productMappingsContent).toBeDefined();
      expect(listProductMappingsResource).toHaveBeenCalledTimes(1);
      expect(productMappingsContent && 'text' in productMappingsContent ? JSON.parse(productMappingsContent.text) : null).toEqual({
        count: 1,
        mappings: [
          {
            id: 'map-1',
            mealieFoodId: 'food-1',
            mealieFoodName: 'Whole Milk',
            grocyProductId: 101,
            grocyProductName: 'Milk',
            unitMappingId: 'unit-map-1',
            createdAt: '2026-03-28T10:00:00.000Z',
            updatedAt: '2026-03-28T10:05:00.000Z',
          },
        ],
      });

      const unitMappingsResource = await client.readResource({ uri: 'gms://mappings/units' });
      const unitMappingsContent = unitMappingsResource.contents[0];
      expect(unitMappingsContent).toBeDefined();
      expect(listUnitMappingsResource).toHaveBeenCalledTimes(1);
      expect(unitMappingsContent && 'text' in unitMappingsContent ? JSON.parse(unitMappingsContent.text) : null).toEqual({
        count: 1,
        mappings: [
          {
            id: 'unit-map-1',
            mealieUnitId: 'unit-1',
            mealieUnitName: 'Liter',
            mealieUnitAbbreviation: 'l',
            grocyUnitId: 10,
            grocyUnitName: 'Litre',
            conversionFactor: 1,
            createdAt: '2026-03-28T10:00:00.000Z',
            updatedAt: '2026-03-28T10:05:00.000Z',
          },
        ],
      });

      const unmappedProductsResource = await client.readResource({ uri: 'gms://products/unmapped' });
      const unmappedProductsContent = unmappedProductsResource.contents[0];
      expect(unmappedProductsContent).toBeDefined();
      expect(listUnmappedProductsResource).toHaveBeenCalledTimes(1);
      expect(unmappedProductsContent && 'text' in unmappedProductsContent ? JSON.parse(unmappedProductsContent.text) : null).toEqual({
        counts: {
          grocyProducts: 1,
          mealieFoods: 1,
        },
        grocyProducts: [
          {
            id: 202,
            name: 'Yoghurt',
            quIdPurchase: 10,
            minStockAmount: 2,
            currentStock: 1,
            isBelowMinimum: true,
          },
        ],
        mealieFoods: [
          {
            id: 'food-2',
            name: 'Greek Yogurt',
          },
        ],
      });

      const unmappedUnitsResource = await client.readResource({ uri: 'gms://units/unmapped' });
      const unmappedUnitsContent = unmappedUnitsResource.contents[0];
      expect(unmappedUnitsContent).toBeDefined();
      expect(listUnmappedUnitsResource).toHaveBeenCalledTimes(1);
      expect(unmappedUnitsContent && 'text' in unmappedUnitsContent ? JSON.parse(unmappedUnitsContent.text) : null).toEqual({
        counts: {
          grocyUnits: 1,
          mealieUnits: 1,
        },
        grocyUnits: [
          {
            id: 20,
            name: 'Pack',
          },
        ],
        mealieUnits: [
          {
            id: 'unit-2',
            name: 'Packet',
            abbreviation: 'pkt',
          },
        ],
      });

      const conflictsResource = await client.readResource({ uri: 'gms://conflicts/open' });
      const conflictsContent = conflictsResource.contents[0];
      expect(conflictsContent).toBeDefined();
      expect(listOpenMappingConflictsResource).toHaveBeenCalledTimes(1);
      expect(conflictsContent && 'text' in conflictsContent ? JSON.parse(conflictsContent.text) : null).toEqual({
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
      });

      const shoppingItemsResource = await client.readResource({ uri: 'gms://shopping/items' });
      const shoppingItemsContent = shoppingItemsResource.contents[0];
      expect(shoppingItemsContent).toBeDefined();
      expect(getShoppingListItemsResource).toHaveBeenCalledTimes(1);
      expect(shoppingItemsContent && 'text' in shoppingItemsContent ? JSON.parse(shoppingItemsContent.text) : null).toEqual({
        shoppingListId: 'list-1',
        configured: true,
        counts: {
          total: 2,
          unchecked: 1,
          checked: 1,
        },
        items: [
          {
            id: 'item-1',
            shoppingListId: 'list-1',
            foodId: 'food-1',
            foodName: 'Milk',
            unitId: 'unit-1',
            unitName: 'Liter',
            quantity: 2,
            checked: false,
            note: null,
            display: 'Milk',
            createdAt: '2026-03-29T09:00:00.000Z',
            updatedAt: '2026-03-29T09:05:00.000Z',
          },
          {
            id: 'item-2',
            shoppingListId: 'list-1',
            foodId: 'food-2',
            foodName: 'Bread',
            unitId: null,
            unitName: null,
            quantity: 1,
            checked: true,
            note: null,
            display: 'Bread',
            createdAt: '2026-03-29T08:00:00.000Z',
            updatedAt: '2026-03-29T08:30:00.000Z',
          },
        ],
      });
    } finally {
      await Promise.allSettled([client.close(), transport.close()]);
    }
  });

  it('rejects non-POST requests', async () => {
    const handleRequest = createMcpHttpHandler();

    const response = await handleRequest(new Request('http://localhost/api/mcp', {
      method: 'GET',
    }));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});
