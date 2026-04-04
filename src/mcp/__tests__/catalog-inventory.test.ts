import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  CreateGrocyLocationResult,
  CreateGrocyProductGroupResult,
  DeleteGrocyLocationResult,
  DeleteGrocyProductGroupResult,
  GrocyLocationsResult,
  GrocyProductGroupsResult,
  UpdateGrocyLocationResult,
  UpdateGrocyProductGroupResult,
} from '@/lib/use-cases/catalog/manage';
import type {
  GetInventoryEntryResult,
  InventoryStockEntriesResult,
  UpdateInventoryEntryResult,
} from '@/lib/use-cases/inventory/manage';
import { createMcpHttpHandler } from '../http';

describe('MCP catalog and inventory entry management', () => {
  const listGrocyLocations = vi.fn(async (): Promise<GrocyLocationsResult> => ({
    count: 1,
    locations: [
      { id: 1, name: 'Pantry', description: 'Dry storage' },
    ],
  }));

  const createGrocyLocation = vi.fn(async (): Promise<CreateGrocyLocationResult> => ({
    created: true,
    locationId: 2,
    name: 'Fridge',
    description: null,
  }));

  const updateGrocyLocation = vi.fn(async (): Promise<UpdateGrocyLocationResult> => ({
    locationId: 2,
    name: 'Fridge',
    updated: {
      description: 'Cold storage',
    },
  }));

  const deleteGrocyLocation = vi.fn(async (): Promise<DeleteGrocyLocationResult> => ({
    deleted: true,
    blocked: false,
    locationId: 2,
    name: 'Fridge',
    blockers: [],
  }));

  const listGrocyProductGroups = vi.fn(async (): Promise<GrocyProductGroupsResult> => ({
    count: 1,
    productGroups: [
      { id: 7, name: 'Dairy', description: 'Cold products' },
    ],
  }));

  const createGrocyProductGroup = vi.fn(async (): Promise<CreateGrocyProductGroupResult> => ({
    created: true,
    productGroupId: 8,
    name: 'Frozen',
    description: null,
  }));

  const updateGrocyProductGroup = vi.fn(async (): Promise<UpdateGrocyProductGroupResult> => ({
    productGroupId: 8,
    name: 'Frozen',
    updated: {
      description: 'Freezer products',
    },
  }));

  const deleteGrocyProductGroup = vi.fn(async (): Promise<DeleteGrocyProductGroupResult> => ({
    deleted: true,
    blocked: false,
    productGroupId: 8,
    name: 'Frozen',
    blockers: [],
  }));

  const listInventoryEntries = vi.fn(async (): Promise<InventoryStockEntriesResult> => ({
    productRef: 'mapping:map-1',
    grocyProductId: 101,
    name: 'Milk',
    count: 1,
    entries: [
      {
        entryId: 12,
        productId: 101,
        locationId: 1,
        shoppingLocationId: null,
        amount: 2,
        bestBeforeDate: '2026-04-15',
        purchasedDate: '2026-04-03',
        stockId: 'stock-12',
        price: 4.5,
        open: true,
        openedDate: null,
        note: null,
        rowCreatedTimestamp: '2026-04-01T10:00:00Z',
      },
    ],
  }));

  const getInventoryEntry = vi.fn(async (): Promise<GetInventoryEntryResult> => ({
    entry: {
      entryId: 12,
      productId: 101,
      locationId: 1,
      shoppingLocationId: null,
      amount: 2,
      bestBeforeDate: '2026-04-15',
      purchasedDate: '2026-04-03',
      stockId: 'stock-12',
      price: 4.5,
      open: true,
      openedDate: null,
      note: null,
      rowCreatedTimestamp: '2026-04-01T10:00:00Z',
    },
  }));

  const updateInventoryEntry = vi.fn(async (): Promise<UpdateInventoryEntryResult> => ({
    entryId: 12,
    updated: {
      amount: 3,
      open: false,
    },
    entry: {
      entryId: 12,
      productId: 101,
      locationId: 1,
      shoppingLocationId: null,
      amount: 3,
      bestBeforeDate: '2026-04-15',
      purchasedDate: '2026-04-03',
      stockId: 'stock-12',
      price: 4.5,
      open: false,
      openedDate: null,
      note: null,
      rowCreatedTimestamp: '2026-04-01T10:00:00Z',
    },
  }));

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('serves catalog CRUD tools and catalog resources', async () => {
    const handleRequest = createMcpHttpHandler({
      catalog: {
        listGrocyLocations,
        createGrocyLocation,
        updateGrocyLocation,
        deleteGrocyLocation,
        listGrocyProductGroups,
        createGrocyProductGroup,
        updateGrocyProductGroup,
        deleteGrocyProductGroup,
      },
    });

    const client = new Client(
      { name: 'mcp-catalog-test-client', version: '1.0.0' },
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
        'catalog.list_locations',
        'catalog.create_location',
        'catalog.update_location',
        'catalog.delete_location',
        'catalog.list_product_groups',
        'catalog.create_product_group',
        'catalog.update_product_group',
        'catalog.delete_product_group',
      ]));
      expect(resources.resources.map(resource => resource.uri)).toEqual(expect.arrayContaining([
        'gms://catalog/locations',
        'gms://catalog/product-groups',
      ]));

      const createLocationResult = await client.callTool({
        name: 'catalog.create_location',
        arguments: { name: 'Fridge' },
      });
      const updateLocationResult = await client.callTool({
        name: 'catalog.update_location',
        arguments: { locationId: 2, description: 'Cold storage' },
      });
      const deleteLocationResult = await client.callTool({
        name: 'catalog.delete_location',
        arguments: { locationId: 2 },
      });
      const createGroupResult = await client.callTool({
        name: 'catalog.create_product_group',
        arguments: { name: 'Frozen' },
      });
      const updateGroupResult = await client.callTool({
        name: 'catalog.update_product_group',
        arguments: { productGroupId: 8, description: 'Freezer products' },
      });
      const deleteGroupResult = await client.callTool({
        name: 'catalog.delete_product_group',
        arguments: { productGroupId: 8 },
      });
      const locationsResource = await client.readResource({ uri: 'gms://catalog/locations' });
      const groupsResource = await client.readResource({ uri: 'gms://catalog/product-groups' });

      expect(createGrocyLocation).toHaveBeenCalledWith({ name: 'Fridge', description: undefined });
      expect(createLocationResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Created the Grocy location.',
        data: {
          created: true,
          locationId: 2,
          name: 'Fridge',
          description: null,
        },
      });
      expect(updateGrocyLocation).toHaveBeenCalledWith({ locationId: 2, name: undefined, description: 'Cold storage' });
      expect(updateLocationResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Updated the Grocy location.',
        data: {
          locationId: 2,
          name: 'Fridge',
          updated: {
            description: 'Cold storage',
          },
        },
      });
      expect(deleteLocationResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Deleted the Grocy location.',
        data: {
          deleted: true,
          blocked: false,
          locationId: 2,
          name: 'Fridge',
          blockers: [],
        },
      });
      expect(createGroupResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Created the Grocy product group.',
        data: {
          created: true,
          productGroupId: 8,
          name: 'Frozen',
          description: null,
        },
      });
      expect(updateGroupResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Updated the Grocy product group.',
        data: {
          productGroupId: 8,
          name: 'Frozen',
          updated: {
            description: 'Freezer products',
          },
        },
      });
      expect(deleteGroupResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Deleted the Grocy product group.',
        data: {
          deleted: true,
          blocked: false,
          productGroupId: 8,
          name: 'Frozen',
          blockers: [],
        },
      });
      expect(locationsResource.contents[0] && 'text' in locationsResource.contents[0]
        ? JSON.parse(locationsResource.contents[0].text)
        : null).toEqual({
        count: 1,
        locations: [
          { id: 1, name: 'Pantry', description: 'Dry storage' },
        ],
      });
      expect(groupsResource.contents[0] && 'text' in groupsResource.contents[0]
        ? JSON.parse(groupsResource.contents[0].text)
        : null).toEqual({
        count: 1,
        productGroups: [
          { id: 7, name: 'Dairy', description: 'Cold products' },
        ],
      });
    } finally {
      await Promise.allSettled([client.close(), transport.close()]);
    }
  });

  it('serves inventory entry tools', async () => {
    const handleRequest = createMcpHttpHandler({
      inventory: {
        listInventoryEntries,
        getInventoryEntry,
        updateInventoryEntry,
      },
    });

    const client = new Client(
      { name: 'mcp-inventory-entry-test-client', version: '1.0.0' },
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
        'inventory.list_entries',
        'inventory.get_entry',
        'inventory.update_entry',
      ]));

      const listResult = await client.callTool({
        name: 'inventory.list_entries',
        arguments: { productRef: 'mapping:map-1' },
      });
      const getResult = await client.callTool({
        name: 'inventory.get_entry',
        arguments: { entryId: 12 },
      });
      const updateResult = await client.callTool({
        name: 'inventory.update_entry',
        arguments: { entryId: 12, amount: 3, open: false },
      });

      expect(listInventoryEntries).toHaveBeenCalledWith({ productRef: 'mapping:map-1' });
      expect(listResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Found 1 inventory entry.',
        data: {
          productRef: 'mapping:map-1',
          grocyProductId: 101,
          name: 'Milk',
          count: 1,
          entries: [
            {
              entryId: 12,
              productId: 101,
              locationId: 1,
              shoppingLocationId: null,
              amount: 2,
              bestBeforeDate: '2026-04-15',
              purchasedDate: '2026-04-03',
              stockId: 'stock-12',
              price: 4.5,
              open: true,
              openedDate: null,
              note: null,
              rowCreatedTimestamp: '2026-04-01T10:00:00Z',
            },
          ],
        },
      });
      expect(getResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Loaded the inventory entry.',
        data: {
          entry: {
            entryId: 12,
            productId: 101,
            locationId: 1,
            shoppingLocationId: null,
            amount: 2,
            bestBeforeDate: '2026-04-15',
            purchasedDate: '2026-04-03',
            stockId: 'stock-12',
            price: 4.5,
            open: true,
            openedDate: null,
            note: null,
            rowCreatedTimestamp: '2026-04-01T10:00:00Z',
          },
        },
      });
      expect(updateInventoryEntry).toHaveBeenCalledWith({
        entryId: 12,
        amount: 3,
        bestBeforeDate: undefined,
        price: undefined,
        open: false,
        locationId: undefined,
        shoppingLocationId: undefined,
        purchasedDate: undefined,
      });
      expect(updateResult.structuredContent).toEqual({
        ok: true,
        status: 'ok',
        message: 'Updated the inventory entry.',
        data: {
          entryId: 12,
          updated: {
            amount: 3,
            open: false,
          },
          entry: {
            entryId: 12,
            productId: 101,
            locationId: 1,
            shoppingLocationId: null,
            amount: 3,
            bestBeforeDate: '2026-04-15',
            purchasedDate: '2026-04-03',
            stockId: 'stock-12',
            price: 4.5,
            open: false,
            openedDate: null,
            note: null,
            rowCreatedTimestamp: '2026-04-01T10:00:00Z',
          },
        },
      });
    } finally {
      await Promise.allSettled([client.close(), transport.close()]);
    }
  });

  it('returns skipped results for blocked catalog deletes', async () => {
    const handleRequest = createMcpHttpHandler({
      catalog: {
        deleteGrocyLocation: vi.fn(async (): Promise<DeleteGrocyLocationResult> => ({
          deleted: false,
          blocked: true,
          locationId: 4,
          name: 'Overflow Shelf',
          blockers: [
            {
              source: 'grocy_stock_entry',
              reference: 'stock-entry:44',
              message: 'Grocy stock entry #44 is stored in this location.',
            },
          ],
        })),
      },
    });

    const client = new Client(
      { name: 'mcp-catalog-skip-test-client', version: '1.0.0' },
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

      const deleteLocationResult = await client.callTool({
        name: 'catalog.delete_location',
        arguments: { locationId: 4 },
      });

      expect(deleteLocationResult.structuredContent).toEqual({
        ok: true,
        status: 'skipped',
        message: 'Skipped Grocy location deletion because the location is still in use.',
        data: {
          deleted: false,
          blocked: true,
          locationId: 4,
          name: 'Overflow Shelf',
          blockers: [
            {
              source: 'grocy_stock_entry',
              reference: 'stock-entry:44',
              message: 'Grocy stock entry #44 is stored in this location.',
            },
          ],
        },
      });
    } finally {
      await Promise.allSettled([client.close(), transport.close()]);
    }
  });
});
