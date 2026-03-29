import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  AddStockResult,
  ConsumeStockResult,
  InventoryStockSnapshot,
  MarkStockOpenedResult,
  SetStockResult,
} from '@/lib/use-cases/inventory/manage';
import type {
  ProductDuplicateCheckResult,
  ProductOverview,
  ProductSearchResult,
} from '@/lib/use-cases/products/catalog';
import type {
  CreateProductInGrocyResult,
  CreateProductInMealieResult,
  CreateProductInBothResult,
  UpdateBasicProductResult,
  UpdateGrocyStockSettingsResult,
} from '@/lib/use-cases/products/manage';
import type {
  LowStockProductsResource,
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
  MergeShoppingListDuplicatesResult,
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
      defaultBestBeforeDaysAfterFreezing: 14,
      defaultBestBeforeDaysAfterThawing: 2,
      dueType: 'expiration',
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

  const mergeShoppingListDuplicates = vi.fn(async (): Promise<MergeShoppingListDuplicatesResult> => ({
    merged: true,
    keptItemId: 'item-1',
    removedItemIds: ['item-4'],
    item: {
      id: 'item-1',
      shoppingListId: 'list-1',
      foodId: 'food-1',
      foodName: 'Milk',
      unitId: null,
      unitName: null,
      quantity: 3,
      checked: false,
      note: null,
      display: 'Milk',
      createdAt: '2026-03-29T09:00:00.000Z',
      updatedAt: '2026-03-29T10:15:00.000Z',
    },
  }));

  const listLowStockProductsResource = vi.fn(async (): Promise<LowStockProductsResource> => ({
    count: 1,
    products: [
      {
        productRef: 'mapping:map-1',
        grocyProductId: 101,
        grocyProductName: 'Milk',
        mealieFoodId: 'food-1',
        mealieFoodName: 'Whole Milk',
        currentStock: 1,
        minStockAmount: 2,
        isBelowMinimum: true,
      },
    ],
  }));

  const getInventoryStock = vi.fn(async (): Promise<InventoryStockSnapshot> => ({
    productRef: 'mapping:map-1',
    grocyProductId: 101,
    name: 'Milk',
    currentStock: 1,
    openedStock: 0,
    unopenedStock: 1,
    minStockAmount: 2,
    isBelowMinimum: true,
    treatOpenedAsOutOfStock: true,
    nextDueDate: '2026-03-31',
    defaultBestBeforeDays: 7,
    defaultBestBeforeDaysAfterOpen: 3,
    defaultBestBeforeDaysAfterFreezing: 14,
    defaultBestBeforeDaysAfterThawing: 2,
    dueType: 'expiration',
    shouldNotBeFrozen: false,
  }));

  const addStock = vi.fn(async (): Promise<AddStockResult> => ({
    productRef: 'mapping:map-1',
    grocyProductId: 101,
    name: 'Milk',
    amount: 2,
    bestBeforeDate: '2026-04-05',
    note: 'Weekly groceries',
  }));

  const consumeStock = vi.fn(async (): Promise<ConsumeStockResult> => ({
    productRef: 'mapping:map-1',
    grocyProductId: 101,
    name: 'Milk',
    amount: 1,
    spoiled: false,
    exactAmount: false,
  }));

  const setStock = vi.fn(async (): Promise<SetStockResult> => ({
    productRef: 'mapping:map-1',
    grocyProductId: 101,
    name: 'Milk',
    amount: 4,
    bestBeforeDate: null,
    note: 'Pantry count',
  }));

  const markStockOpened = vi.fn(async (): Promise<MarkStockOpenedResult> => ({
    productRef: 'mapping:map-1',
    grocyProductId: 101,
    name: 'Milk',
    amount: 1,
  }));

  const updateGrocyStockSettings = vi.fn(async (): Promise<UpdateGrocyStockSettingsResult> => ({
    productRef: 'mapping:map-1',
    grocyProductId: 101,
    name: 'Milk',
    updated: {
      minStockAmount: 4,
      treatOpenedAsOutOfStock: true,
      defaultBestBeforeDays: 10,
      defaultBestBeforeDaysAfterOpen: 2,
      frozenShelfLifeDays: 30,
      thawedShelfLifeDays: 4,
      bestBeforeType: 'expiration',
      allowFreezing: false,
    },
  }));

  const createProductInBoth = vi.fn(async (): Promise<CreateProductInBothResult> => ({
    created: true,
    grocyProductId: 303,
    grocyProductName: 'Pasta',
    mealieFoodId: 'food-303',
    mealieFoodName: 'Pasta',
    unitMappingId: 'unit-map-1',
    duplicateCheck: {
      skipped: false,
      exactGrocyMatches: 0,
      exactMealieMatches: 0,
    },
  }));

  const createProductInGrocy = vi.fn(async (): Promise<CreateProductInGrocyResult> => ({
    created: true,
    grocyProductId: 404,
    grocyProductName: 'Beans',
    duplicateCheck: {
      skipped: false,
      exactGrocyMatches: 0,
    },
  }));

  const createProductInMealie = vi.fn(async (): Promise<CreateProductInMealieResult> => ({
    created: true,
    mealieFoodId: 'food-404',
    mealieFoodName: 'Oats',
    duplicateCheck: {
      skipped: false,
      exactMealieMatches: 0,
    },
  }));

  const updateBasicProduct = vi.fn(async (): Promise<UpdateBasicProductResult> => ({
    productRef: 'mapping:map-1',
    grocyProductId: 101,
    mealieFoodId: 'food-1',
    updated: {
      grocyName: 'Semi-skimmed milk',
      mealieName: 'Semi Skimmed Milk',
      mealiePluralName: 'Semi Skimmed Milks',
      mealieAliases: ['Milk'],
    },
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
        updateGrocyStockSettings,
        createProductInGrocy,
        createProductInMealie,
        createProductInBoth,
        updateBasicProduct,
      },
      resources: {
        getStatusResource,
        listProductMappingsResource,
        listUnitMappingsResource,
        listUnmappedProductsResource,
        listUnmappedUnitsResource,
        listOpenMappingConflictsResource,
        getShoppingListItemsResource,
        listLowStockProductsResource,
      },
      shopping: {
        getShoppingListItemsResource,
        checkShoppingListProduct,
        addShoppingListItem,
        removeShoppingListItem,
        mergeShoppingListDuplicates,
      },
      inventory: {
        getInventoryStock,
        listLowStockProductsResource,
        addStock,
        consumeStock,
        setStock,
        markStockOpened,
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
        'shopping.merge_duplicates',
        'inventory.get_stock',
        'inventory.list_low_stock',
        'inventory.add_stock',
        'inventory.consume_stock',
        'inventory.set_stock',
        'inventory.mark_opened',
        'products.update_grocy_stock_settings',
        'products.create_grocy',
        'products.create_mealie',
        'products.create_in_both',
        'products.update_basic',
      ]));
      expect(resources.resources.map(resource => resource.uri)).toEqual(expect.arrayContaining([
        'gms://status',
        'gms://mappings/products',
        'gms://mappings/units',
        'gms://products/unmapped',
        'gms://units/unmapped',
        'gms://conflicts/open',
        'gms://shopping/items',
        'gms://inventory/low-stock',
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

      const shoppingMergeResult = await client.callTool({
        name: 'shopping.merge_duplicates',
        arguments: { foodId: 'food-1' },
      });

      const inventoryStockResult = await client.callTool({
        name: 'inventory.get_stock',
        arguments: { productRef: 'mapping:map-1' },
      });

      const inventoryAddResult = await client.callTool({
        name: 'inventory.add_stock',
        arguments: {
          productRef: 'mapping:map-1',
          amount: 2,
          bestBeforeDate: '2026-04-05',
          note: 'Weekly groceries',
        },
      });

      const productSettingsResult = await client.callTool({
        name: 'products.update_grocy_stock_settings',
        arguments: {
          productRef: 'mapping:map-1',
          minStockAmount: 4,
          treatOpenedAsOutOfStock: true,
          defaultBestBeforeDays: 10,
          defaultBestBeforeDaysAfterOpen: 2,
          frozenShelfLifeDays: 30,
          thawedShelfLifeDays: 4,
          bestBeforeType: 'expiration',
          allowFreezing: false,
        },
      });

      const createInBothResult = await client.callTool({
        name: 'products.create_in_both',
        arguments: {
          name: 'Pasta',
          grocyUnitId: 10,
          minStockAmount: 1,
          mealiePluralName: 'Pastas',
          mealieAliases: ['Spaghetti'],
        },
      });

      const createGrocyResult = await client.callTool({
        name: 'products.create_grocy',
        arguments: {
          name: 'Beans',
          grocyUnitId: 10,
          minStockAmount: 2,
        },
      });

      const createMealieResult = await client.callTool({
        name: 'products.create_mealie',
        arguments: {
          name: 'Oats',
          pluralName: 'Oats',
          aliases: ['Rolled oats'],
        },
      });

      const updateBasicResult = await client.callTool({
        name: 'products.update_basic',
        arguments: {
          productRef: 'mapping:map-1',
          grocyName: 'Semi-skimmed milk',
          mealieName: 'Semi Skimmed Milk',
          mealiePluralName: 'Semi Skimmed Milks',
          mealieAliases: ['Milk'],
        },
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
      expect(mergeShoppingListDuplicates).toHaveBeenCalledWith({ foodId: 'food-1' });
      expect(shoppingMergeResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Merged duplicate shopping list items.',
        data: {
          merged: true,
          keptItemId: 'item-1',
          removedItemIds: ['item-4'],
          item: {
            id: 'item-1',
            shoppingListId: 'list-1',
            foodId: 'food-1',
            foodName: 'Milk',
            unitId: null,
            unitName: null,
            quantity: 3,
            checked: false,
            note: null,
            display: 'Milk',
            createdAt: '2026-03-29T09:00:00.000Z',
            updatedAt: '2026-03-29T10:15:00.000Z',
          },
        },
      });
      expect(getInventoryStock).toHaveBeenCalledWith({ productRef: 'mapping:map-1' });
      expect(inventoryStockResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Loaded current stock state.',
        data: {
          productRef: 'mapping:map-1',
          grocyProductId: 101,
          name: 'Milk',
          currentStock: 1,
          openedStock: 0,
          unopenedStock: 1,
          minStockAmount: 2,
          isBelowMinimum: true,
          treatOpenedAsOutOfStock: true,
          nextDueDate: '2026-03-31',
          defaultBestBeforeDays: 7,
          defaultBestBeforeDaysAfterOpen: 3,
          defaultBestBeforeDaysAfterFreezing: 14,
          defaultBestBeforeDaysAfterThawing: 2,
          dueType: 'expiration',
          shouldNotBeFrozen: false,
        },
      });
      expect(addStock).toHaveBeenCalledWith({
        productRef: 'mapping:map-1',
        amount: 2,
        bestBeforeDate: '2026-04-05',
        note: 'Weekly groceries',
      });
      expect(inventoryAddResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Added stock in Grocy.',
        data: {
          productRef: 'mapping:map-1',
          grocyProductId: 101,
          name: 'Milk',
          amount: 2,
          bestBeforeDate: '2026-04-05',
          note: 'Weekly groceries',
        },
      });
      expect(updateGrocyStockSettings).toHaveBeenCalledWith({
        productRef: 'mapping:map-1',
        minStockAmount: 4,
        treatOpenedAsOutOfStock: true,
        defaultBestBeforeDays: 10,
        defaultBestBeforeDaysAfterOpen: 2,
        frozenShelfLifeDays: 30,
        thawedShelfLifeDays: 4,
        bestBeforeType: 'expiration',
        allowFreezing: false,
      });
      expect(productSettingsResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Updated Grocy stock settings.',
        data: {
          productRef: 'mapping:map-1',
          grocyProductId: 101,
          name: 'Milk',
          updated: {
            minStockAmount: 4,
            treatOpenedAsOutOfStock: true,
            defaultBestBeforeDays: 10,
            defaultBestBeforeDaysAfterOpen: 2,
            frozenShelfLifeDays: 30,
            thawedShelfLifeDays: 4,
            bestBeforeType: 'expiration',
            allowFreezing: false,
          },
        },
      });
      expect(createProductInBoth).toHaveBeenCalledWith({
        name: 'Pasta',
        grocyUnitId: 10,
        locationId: undefined,
        minStockAmount: 1,
        mealiePluralName: 'Pastas',
        mealieAliases: ['Spaghetti'],
      });
      expect(createInBothResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Created the product in Grocy and Mealie and stored the mapping.',
        data: {
          created: true,
          grocyProductId: 303,
          grocyProductName: 'Pasta',
          mealieFoodId: 'food-303',
          mealieFoodName: 'Pasta',
          unitMappingId: 'unit-map-1',
          duplicateCheck: {
            skipped: false,
            exactGrocyMatches: 0,
            exactMealieMatches: 0,
          },
        },
      });
      expect(createProductInGrocy).toHaveBeenCalledWith({
        name: 'Beans',
        grocyUnitId: 10,
        locationId: undefined,
        minStockAmount: 2,
      });
      expect(createGrocyResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Created the product in Grocy.',
        data: {
          created: true,
          grocyProductId: 404,
          grocyProductName: 'Beans',
          duplicateCheck: {
            skipped: false,
            exactGrocyMatches: 0,
          },
        },
      });
      expect(createProductInMealie).toHaveBeenCalledWith({
        name: 'Oats',
        pluralName: 'Oats',
        aliases: ['Rolled oats'],
      });
      expect(createMealieResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Created the product in Mealie.',
        data: {
          created: true,
          mealieFoodId: 'food-404',
          mealieFoodName: 'Oats',
          duplicateCheck: {
            skipped: false,
            exactMealieMatches: 0,
          },
        },
      });
      expect(updateBasicProduct).toHaveBeenCalledWith({
        productRef: 'mapping:map-1',
        grocyName: 'Semi-skimmed milk',
        mealieName: 'Semi Skimmed Milk',
        mealiePluralName: 'Semi Skimmed Milks',
        mealieAliases: ['Milk'],
      });
      expect(updateBasicResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Updated the basic product metadata.',
        data: {
          productRef: 'mapping:map-1',
          grocyProductId: 101,
          mealieFoodId: 'food-1',
          updated: {
            grocyName: 'Semi-skimmed milk',
            mealieName: 'Semi Skimmed Milk',
            mealiePluralName: 'Semi Skimmed Milks',
            mealieAliases: ['Milk'],
          },
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
          defaultBestBeforeDaysAfterFreezing: 14,
          defaultBestBeforeDaysAfterThawing: 2,
          dueType: 'expiration',
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

      const lowStockResource = await client.readResource({ uri: 'gms://inventory/low-stock' });
      const lowStockContent = lowStockResource.contents[0];
      expect(lowStockContent).toBeDefined();
      expect(listLowStockProductsResource).toHaveBeenCalledTimes(1);
      expect(lowStockContent && 'text' in lowStockContent ? JSON.parse(lowStockContent.text) : null).toEqual({
        count: 1,
        products: [
          {
            productRef: 'mapping:map-1',
            grocyProductId: 101,
            grocyProductName: 'Milk',
            mealieFoodId: 'food-1',
            mealieFoodName: 'Whole Milk',
            currentStock: 1,
            minStockAmount: 2,
            isBelowMinimum: true,
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
