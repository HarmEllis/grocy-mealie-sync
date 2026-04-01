import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  RemoveProductMappingResult,
  RemoveUnitMappingResult,
  UpsertProductMappingResult,
  UpsertUnitMappingResult,
} from '@/lib/use-cases/mappings/manage';
import type {
  DeleteProductResult,
} from '@/lib/use-cases/products/manage';
import type {
  SuggestProductMappingsResult,
  SuggestUnitMappingsResult,
} from '@/lib/use-cases/mappings/suggestions';
import type {
  ProductMappingsResource,
  UnitMappingsResource,
  UnmappedProductsResource,
  UnmappedUnitsResource,
} from '@/lib/use-cases/resources/read-models';
import type {
  CompareUnitsResult,
  CreateGrocyUnitResult,
  CreateMealieUnitResult,
  UnitCatalogResource,
  UpdateGrocyUnitMetadataResult,
  UpdateMealieUnitMetadataResult,
} from '@/lib/use-cases/units/manage';
import { createMcpHttpHandler } from '../http';

describe('MCP mapping and unit management', () => {
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
    counts: { grocyProducts: 0, mealieFoods: 1 },
    grocyProducts: [],
    mealieFoods: [{ id: 'food-9', name: 'Pasta' }],
  }));

  const listUnmappedUnitsResource = vi.fn(async (): Promise<UnmappedUnitsResource> => ({
    counts: { grocyUnits: 1, mealieUnits: 0 },
    grocyUnits: [{ id: 20, name: 'Pack' }],
    mealieUnits: [],
  }));

  const getUnitCatalog = vi.fn(async (): Promise<UnitCatalogResource> => ({
    counts: {
      grocyUnits: 1,
      mealieUnits: 1,
      mappedUnits: 1,
    },
    grocyUnits: [
      {
        id: 10,
        name: 'Litre',
        pluralName: 'Litres',
        pluralForms: ['liter', 'liters'],
        mappingId: 'unit-map-1',
      },
    ],
    mealieUnits: [
      {
        id: 'unit-1',
        name: 'Liter',
        pluralName: 'Liters',
        abbreviation: 'l',
        pluralAbbreviation: 'ls',
        aliases: ['litre'],
        mappingId: 'unit-map-1',
      },
    ],
  }));

  const upsertProductMapping = vi.fn(async (): Promise<UpsertProductMappingResult> => ({
    mappingId: 'map-1',
    mealieFoodId: 'food-1',
    mealieFoodName: 'Whole Milk',
    grocyProductId: 101,
    grocyProductName: 'Whole Milk',
    unitMappingId: 'unit-map-1',
    renamedGrocyProduct: true,
  }));

  const removeProductMapping = vi.fn(async (): Promise<RemoveProductMappingResult> => ({
    removed: true,
    mappingId: 'map-1',
  }));

  const upsertUnitMapping = vi.fn(async (): Promise<UpsertUnitMappingResult> => ({
    mappingId: 'unit-map-1',
    mealieUnitId: 'unit-1',
    mealieUnitName: 'Liter',
    grocyUnitId: 10,
    grocyUnitName: 'Liter',
    renamedGrocyUnit: true,
  }));

  const removeUnitMapping = vi.fn(async (): Promise<RemoveUnitMappingResult> => ({
    removed: true,
    mappingId: 'unit-map-1',
  }));

  const suggestProductMappings = vi.fn(async (): Promise<SuggestProductMappingsResult> => ({
    count: 2,
    suggestions: [
      {
        mealieFoodId: 'food-2',
        mealieFoodName: 'Butter',
        grocyProductId: 202,
        grocyProductName: 'Butter',
        score: 100,
        suggestedUnitId: null,
        ambiguous: false,
      },
      {
        mealieFoodId: 'food-1',
        mealieFoodName: 'Whole Milk',
        grocyProductId: 101,
        grocyProductName: 'Milk',
        score: 95,
        suggestedUnitId: 10,
        ambiguous: false,
      },
    ],
  }));

  const suggestUnitMappings = vi.fn(async (): Promise<SuggestUnitMappingsResult> => ({
    count: 1,
    suggestions: [
      {
        mealieUnitId: 'unit-2',
        mealieUnitName: 'Packet',
        grocyUnitId: 20,
        grocyUnitName: 'Pack',
        score: 100,
        ambiguous: false,
      },
    ],
  }));

  const updateGrocyUnitMetadata = vi.fn(async (): Promise<UpdateGrocyUnitMetadataResult> => ({
    grocyUnitId: 10,
    updated: {
      name: 'Can',
      pluralName: 'Cans',
      pluralForms: ['tin', 'tins'],
    },
  }));

  const updateMealieUnitMetadata = vi.fn(async (): Promise<UpdateMealieUnitMetadataResult> => ({
    mealieUnitId: 'unit-1',
    updated: {
      name: 'tablespoon',
      pluralName: 'tablespoons',
      abbreviation: 'tbsp',
      pluralAbbreviation: 'tbsps',
      aliases: ['eetlepel'],
    },
  }));

  const createGrocyUnit = vi.fn(async (): Promise<CreateGrocyUnitResult> => ({
    created: true,
    grocyUnitId: 30,
    grocyUnitName: 'Can',
    duplicateCheck: {
      skipped: false,
      exactGrocyMatches: 0,
    },
  }));

  const createMealieUnit = vi.fn(async (): Promise<CreateMealieUnitResult> => ({
    created: true,
    mealieUnitId: 'unit-30',
    mealieUnitName: 'Tablespoon',
    duplicateCheck: {
      skipped: false,
      exactMealieMatches: 0,
    },
  }));

  const compareUnits = vi.fn(async (): Promise<CompareUnitsResult> => ({
    mealieUnitId: 'unit-1',
    grocyUnitId: 10,
    currentlyMapped: true,
    nameMatches: false,
    aliasMatches: true,
    mealieUnit: {
      id: 'unit-1',
      name: 'Liter',
      pluralName: 'Liters',
      abbreviation: 'l',
      pluralAbbreviation: 'ls',
      aliases: ['litre'],
      mappingId: 'unit-map-1',
    },
    grocyUnit: {
      id: 10,
      name: 'Litre',
      pluralName: 'Litres',
      pluralForms: ['liter', 'liters'],
      mappingId: 'unit-map-1',
    },
    notes: [
      'The Mealie unit aliases overlap with the Grocy unit naming.',
    ],
  }));

  const normalizeMappedUnits = vi.fn(async () => ({
    normalizedMealie: 1,
    normalizedGrocy: 1,
    skippedDuplicates: [],
  }));

  const deleteProduct = vi.fn(async (): Promise<DeleteProductResult> => ({
    deleted: true,
    system: 'grocy',
    productId: 999,
  }));

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('serves mapping and unit management tools and resources', async () => {
    const handleRequest = createMcpHttpHandler({
      resources: {
        listProductMappingsResource,
        listUnitMappingsResource,
        listUnmappedProductsResource,
        listUnmappedUnitsResource,
        getUnitCatalogResource: getUnitCatalog,
      },
      mappings: {
        listProductMappingsResource,
        listUnitMappingsResource,
        listUnmappedProductsResource,
        listUnmappedUnitsResource,
        suggestProductMappings,
        suggestUnitMappings,
        upsertProductMapping,
        removeProductMapping,
        upsertUnitMapping,
        removeUnitMapping,
      },
      units: {
        getUnitCatalog,
        createGrocyUnit,
        createMealieUnit,
        compareUnits,
        normalizeMappedUnits,
        updateGrocyUnitMetadata,
        updateMealieUnitMetadata,
      },
      products: {
        deleteProduct,
      },
    });

    const client = new Client(
      { name: 'mcp-management-test-client', version: '1.0.0' },
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

      const [tools, resources] = await Promise.all([
        client.listTools(),
        client.listResources(),
      ]);

      expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
        'mappings.list_products',
        'mappings.list_units',
        'mappings.list_unmapped',
        'mappings.suggest_products',
        'mappings.suggest_units',
        'mappings.upsert_product',
        'mappings.remove_product',
        'mappings.upsert_unit',
        'mappings.remove_unit',
        'units.list_catalog',
        'units.create_grocy',
        'units.create_mealie',
        'units.compare',
        'units.normalize',
        'units.update_grocy',
        'units.update_mealie',
        'products.delete',
      ]));
      expect(resources.resources.map(resource => resource.uri)).toEqual(expect.arrayContaining([
        'gms://units/catalog',
      ]));

      const unmappedResult = await client.callTool({
        name: 'mappings.list_unmapped',
        arguments: {},
      });
      const upsertProductResult = await client.callTool({
        name: 'mappings.upsert_product',
        arguments: {
          mealieFoodId: 'food-1',
          grocyProductId: 101,
          grocyUnitId: 10,
        },
      });
      const suggestProductsResult = await client.callTool({
        name: 'mappings.suggest_products',
        arguments: {},
      });
      const suggestUnitsResult = await client.callTool({
        name: 'mappings.suggest_units',
        arguments: {},
      });
      const removeUnitResult = await client.callTool({
        name: 'mappings.remove_unit',
        arguments: {
          mappingId: 'unit-map-1',
        },
      });
      const unitCatalogResult = await client.callTool({
        name: 'units.list_catalog',
        arguments: {},
      });
      const createGrocyUnitResult = await client.callTool({
        name: 'units.create_grocy',
        arguments: {
          name: 'Can',
          pluralName: 'Cans',
          pluralForms: ['tin', 'tins'],
        },
      });
      const createMealieUnitResult = await client.callTool({
        name: 'units.create_mealie',
        arguments: {
          name: 'Tablespoon',
          pluralName: 'Tablespoons',
          abbreviation: 'tbsp',
          aliases: ['eetlepel'],
        },
      });
      const updateMealieUnitResult = await client.callTool({
        name: 'units.update_mealie',
        arguments: {
          mealieUnitId: 'unit-1',
          name: 'tablespoon',
          pluralName: 'tablespoons',
          abbreviation: 'tbsp',
          pluralAbbreviation: 'tbsps',
          aliases: ['eetlepel'],
        },
      });
      const compareUnitsResult = await client.callTool({
        name: 'units.compare',
        arguments: {
          mealieUnitId: 'unit-1',
          grocyUnitId: 10,
        },
      });
      const normalizeUnitsResult = await client.callTool({
        name: 'units.normalize',
        arguments: {},
      });

      expect(unmappedResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Loaded unmapped products and units.',
        data: {
          products: {
            counts: { grocyProducts: 0, mealieFoods: 1 },
            grocyProducts: [],
            mealieFoods: [{ id: 'food-9', name: 'Pasta' }],
          },
          units: {
            counts: { grocyUnits: 1, mealieUnits: 0 },
            grocyUnits: [{ id: 20, name: 'Pack' }],
            mealieUnits: [],
          },
        },
      });
      expect(upsertProductMapping).toHaveBeenCalledWith({
        mappingId: undefined,
        mealieFoodId: 'food-1',
        grocyProductId: 101,
        grocyUnitId: 10,
      });
      expect(upsertProductResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Upserted the product mapping.',
        data: {
          mappingId: 'map-1',
          mealieFoodId: 'food-1',
          mealieFoodName: 'Whole Milk',
          grocyProductId: 101,
          grocyProductName: 'Whole Milk',
          unitMappingId: 'unit-map-1',
          renamedGrocyProduct: true,
        },
      });
      expect(suggestProductMappings).toHaveBeenCalledTimes(1);
      expect(suggestProductsResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Found 2 product mapping suggestions.',
        data: {
          count: 2,
          suggestions: [
            {
              mealieFoodId: 'food-2',
              mealieFoodName: 'Butter',
              grocyProductId: 202,
              grocyProductName: 'Butter',
              score: 100,
              suggestedUnitId: null,
              ambiguous: false,
            },
            {
              mealieFoodId: 'food-1',
              mealieFoodName: 'Whole Milk',
              grocyProductId: 101,
              grocyProductName: 'Milk',
              score: 95,
              suggestedUnitId: 10,
              ambiguous: false,
            },
          ],
        },
      });
      expect(suggestUnitMappings).toHaveBeenCalledTimes(1);
      expect(suggestUnitsResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Found 1 unit mapping suggestion.',
        data: {
          count: 1,
          suggestions: [
            {
              mealieUnitId: 'unit-2',
              mealieUnitName: 'Packet',
              grocyUnitId: 20,
              grocyUnitName: 'Pack',
              score: 100,
              ambiguous: false,
            },
          ],
        },
      });
      expect(removeUnitMapping).toHaveBeenCalledWith({ mappingId: 'unit-map-1' });
      expect(removeUnitResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Removed the unit mapping.',
        data: {
          removed: true,
          mappingId: 'unit-map-1',
        },
      });
      expect(unitCatalogResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Found 1 unit catalog entry.',
        data: {
          counts: {
            grocyUnits: 1,
            mealieUnits: 1,
            mappedUnits: 1,
          },
          grocyUnits: [
            {
              id: 10,
              name: 'Litre',
              pluralName: 'Litres',
              pluralForms: ['liter', 'liters'],
              mappingId: 'unit-map-1',
            },
          ],
          mealieUnits: [
            {
              id: 'unit-1',
              name: 'Liter',
              pluralName: 'Liters',
              abbreviation: 'l',
              pluralAbbreviation: 'ls',
              aliases: ['litre'],
              mappingId: 'unit-map-1',
            },
          ],
        },
      });
      expect(createGrocyUnit).toHaveBeenCalledWith({
        name: 'Can',
        pluralName: 'Cans',
        pluralForms: ['tin', 'tins'],
        description: undefined,
      });
      expect(createGrocyUnitResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Created the Grocy unit.',
        data: {
          created: true,
          grocyUnitId: 30,
          grocyUnitName: 'Can',
          duplicateCheck: {
            skipped: false,
            exactGrocyMatches: 0,
          },
        },
      });
      expect(createMealieUnit).toHaveBeenCalledWith({
        name: 'Tablespoon',
        pluralName: 'Tablespoons',
        abbreviation: 'tbsp',
        pluralAbbreviation: undefined,
        aliases: ['eetlepel'],
        description: undefined,
        fraction: undefined,
        useAbbreviation: undefined,
      });
      expect(createMealieUnitResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Created the Mealie unit.',
        data: {
          created: true,
          mealieUnitId: 'unit-30',
          mealieUnitName: 'Tablespoon',
          duplicateCheck: {
            skipped: false,
            exactMealieMatches: 0,
          },
        },
      });
      expect(updateMealieUnitMetadata).toHaveBeenCalledWith({
        mealieUnitId: 'unit-1',
        name: 'tablespoon',
        pluralName: 'tablespoons',
        abbreviation: 'tbsp',
        pluralAbbreviation: 'tbsps',
        aliases: ['eetlepel'],
      });
      expect(updateMealieUnitResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Updated the Mealie unit metadata.',
        data: {
          mealieUnitId: 'unit-1',
          updated: {
            name: 'tablespoon',
            pluralName: 'tablespoons',
            abbreviation: 'tbsp',
            pluralAbbreviation: 'tbsps',
            aliases: ['eetlepel'],
          },
        },
      });
      expect(compareUnits).toHaveBeenCalledWith({
        mealieUnitId: 'unit-1',
        grocyUnitId: 10,
      });
      expect(compareUnitsResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Compared the selected units.',
        data: {
          mealieUnitId: 'unit-1',
          grocyUnitId: 10,
          currentlyMapped: true,
          nameMatches: false,
          aliasMatches: true,
          mealieUnit: {
            id: 'unit-1',
            name: 'Liter',
            pluralName: 'Liters',
            abbreviation: 'l',
            pluralAbbreviation: 'ls',
            aliases: ['litre'],
            mappingId: 'unit-map-1',
          },
          grocyUnit: {
            id: 10,
            name: 'Litre',
            pluralName: 'Litres',
            pluralForms: ['liter', 'liters'],
            mappingId: 'unit-map-1',
          },
          notes: [
            'The Mealie unit aliases overlap with the Grocy unit naming.',
          ],
        },
      });
      expect(normalizeMappedUnits).toHaveBeenCalledTimes(1);
      expect(normalizeUnitsResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Normalized mapped unit metadata.',
        data: {
          normalizedMealie: 1,
          normalizedGrocy: 1,
          skippedDuplicates: [],
        },
      });

      const unitCatalogResource = await client.readResource({ uri: 'gms://units/catalog' });
      const unitCatalogContent = unitCatalogResource.contents[0];

      expect(unitCatalogContent).toBeDefined();
      expect(getUnitCatalog).toHaveBeenCalledTimes(2);
      expect(unitCatalogContent && 'text' in unitCatalogContent ? JSON.parse(unitCatalogContent.text) : null).toEqual({
        counts: {
          grocyUnits: 1,
          mealieUnits: 1,
          mappedUnits: 1,
        },
        grocyUnits: [
          {
            id: 10,
            name: 'Litre',
            pluralName: 'Litres',
            pluralForms: ['liter', 'liters'],
            mappingId: 'unit-map-1',
          },
        ],
        mealieUnits: [
          {
            id: 'unit-1',
            name: 'Liter',
            pluralName: 'Liters',
            abbreviation: 'l',
            pluralAbbreviation: 'ls',
            aliases: ['litre'],
            mappingId: 'unit-map-1',
          },
        ],
      });
    } finally {
      await Promise.allSettled([client.close(), transport.close()]);
    }
  });
});
