import { describe, expect, it, vi } from 'vitest';
import {
  createGrocyLocation,
  createGrocyProductGroup,
  deleteGrocyLocation,
  deleteGrocyProductGroup,
  listGrocyLocations,
  listGrocyProductGroups,
  updateGrocyLocation,
  updateGrocyProductGroup,
} from '../manage';

describe('catalog management use-cases', () => {
  it('lists Grocy locations with stable ordering', async () => {
    const result = await listGrocyLocations({
      listGrocyLocations: vi.fn(async () => [
        { id: 2, name: 'Freezer', description: 'Cold storage' },
        { id: 1, name: 'Pantry', description: null },
      ] as any),
    });

    expect(result).toEqual({
      count: 2,
      locations: [
        { id: 2, name: 'Freezer', description: 'Cold storage' },
        { id: 1, name: 'Pantry', description: null },
      ],
    });
  });

  it('creates and updates a Grocy location', async () => {
    const createLocationDep = vi.fn(async () => ({ createdObjectId: 4 }));
    const updateLocationDep = vi.fn(async () => undefined);

    const created = await createGrocyLocation(
      {
        name: ' Cellar ',
        description: ' Dark shelf ',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        createGrocyLocation: createLocationDep,
      },
    );

    const updated = await updateGrocyLocation(
      {
        locationId: 4,
        name: 'Root Cellar',
        description: null,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyLocations: vi.fn(async () => [
          { id: 4, name: 'Cellar', description: 'Dark shelf' },
        ] as any),
        updateGrocyLocation: updateLocationDep,
      },
    );

    expect(createLocationDep).toHaveBeenCalledWith({
      name: 'Cellar',
      description: 'Dark shelf',
    });
    expect(created).toEqual({
      created: true,
      locationId: 4,
      name: 'Cellar',
      description: 'Dark shelf',
    });
    expect(updateLocationDep).toHaveBeenCalledWith(4, {
      name: 'Root Cellar',
      description: null,
    });
    expect(updated).toEqual({
      locationId: 4,
      name: 'Root Cellar',
      updated: {
        name: 'Root Cellar',
        description: null,
      },
    });
  });

  it('rejects location updates with no fields', async () => {
    await expect(updateGrocyLocation(
      { locationId: 4 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyLocations: vi.fn(async () => [
          { id: 4, name: 'Cellar', description: 'Dark shelf' },
        ] as any),
        updateGrocyLocation: vi.fn(async () => undefined),
      },
    )).rejects.toThrow('Provide at least one field to update the Grocy location.');
  });

  it('blocks deleting a location when products or stock entries still reference it', async () => {
    const deleteLocationDep = vi.fn(async () => undefined);

    const result = await deleteGrocyLocation(
      { locationId: 3 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyLocations: vi.fn(async () => [
          { id: 3, name: 'Fridge', description: null },
        ] as any),
        deleteGrocyLocation: deleteLocationDep,
        listGrocyProducts: vi.fn(async () => [
          { id: 101, name: 'Milk', location_id: 3 },
        ] as any),
        listLocationStockEntries: vi.fn(async () => [
          { id: 1, product_id: 101, location_id: 3, amount: 1 },
        ] as any),
      },
    );

    expect(result).toEqual({
      deleted: false,
      blocked: true,
      locationId: 3,
      name: 'Fridge',
      blockers: [
        {
          source: 'grocy_product_location',
          reference: 'grocy-product:101',
          message: 'Grocy product "Milk" uses this location as its storage location.',
        },
        {
          source: 'grocy_stock_entry',
          reference: 'stock-entry:1',
          message: 'Grocy stock entry #1 is stored in this location.',
        },
      ],
    });
    expect(deleteLocationDep).not.toHaveBeenCalled();
  });

  it('blocks deleting a location when only stock entries still reference it', async () => {
    const deleteLocationDep = vi.fn(async () => undefined);

    const result = await deleteGrocyLocation(
      { locationId: 9 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyLocations: vi.fn(async () => [
          { id: 9, name: 'Overflow Shelf', description: null },
        ] as any),
        deleteGrocyLocation: deleteLocationDep,
        listGrocyProducts: vi.fn(async () => []),
        listLocationStockEntries: vi.fn(async () => [
          { id: 44, product_id: 101, location_id: 9, amount: 2 },
        ] as any),
      },
    );

    expect(result).toEqual({
      deleted: false,
      blocked: true,
      locationId: 9,
      name: 'Overflow Shelf',
      blockers: [
        {
          source: 'grocy_stock_entry',
          reference: 'stock-entry:44',
          message: 'Grocy stock entry #44 is stored in this location.',
        },
      ],
    });
    expect(deleteLocationDep).not.toHaveBeenCalled();
  });

  it('lists, creates, updates, and deletes a product group', async () => {
    const createGroupDep = vi.fn(async () => ({ createdObjectId: 8 }));
    const updateGroupDep = vi.fn(async () => undefined);
    const deleteGroupDep = vi.fn(async () => undefined);

    const listed = await listGrocyProductGroups({
      listGrocyProductGroups: vi.fn(async () => [
        { id: 8, name: 'Dairy', description: 'Cold products' },
      ] as any),
    });
    const created = await createGrocyProductGroup(
      {
        name: ' Dairy ',
        description: ' Cold products ',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        createGrocyProductGroup: createGroupDep,
      },
    );
    const updated = await updateGrocyProductGroup(
      {
        productGroupId: 8,
        description: null,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyProductGroups: vi.fn(async () => [
          { id: 8, name: 'Dairy', description: 'Cold products' },
        ] as any),
        updateGrocyProductGroup: updateGroupDep,
      },
    );
    const deleted = await deleteGrocyProductGroup(
      { productGroupId: 8 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyProductGroups: vi.fn(async () => [
          { id: 8, name: 'Dairy', description: null },
        ] as any),
        deleteGrocyProductGroup: deleteGroupDep,
        listGrocyProducts: vi.fn(async () => []),
      },
    );

    expect(listed).toEqual({
      count: 1,
      productGroups: [
        { id: 8, name: 'Dairy', description: 'Cold products' },
      ],
    });
    expect(createGroupDep).toHaveBeenCalledWith({
      name: 'Dairy',
      description: 'Cold products',
    });
    expect(created).toEqual({
      created: true,
      productGroupId: 8,
      name: 'Dairy',
      description: 'Cold products',
    });
    expect(updateGroupDep).toHaveBeenCalledWith(8, {
      description: null,
    });
    expect(updated).toEqual({
      productGroupId: 8,
      name: 'Dairy',
      updated: {
        description: null,
      },
    });
    expect(deleteGroupDep).toHaveBeenCalledWith(8);
    expect(deleted).toEqual({
      deleted: true,
      blocked: false,
      productGroupId: 8,
      name: 'Dairy',
      blockers: [],
    });
  });

  it('rejects product group updates with no fields', async () => {
    await expect(updateGrocyProductGroup(
      { productGroupId: 8 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyProductGroups: vi.fn(async () => [
          { id: 8, name: 'Dairy', description: 'Cold products' },
        ] as any),
        updateGrocyProductGroup: vi.fn(async () => undefined),
      },
    )).rejects.toThrow('Provide at least one field to update the Grocy product group.');
  });

  it('blocks deleting a product group when products are still assigned', async () => {
    const deleteGroupDep = vi.fn(async () => undefined);

    const result = await deleteGrocyProductGroup(
      { productGroupId: 5 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyProductGroups: vi.fn(async () => [
          { id: 5, name: 'Frozen', description: null },
        ] as any),
        deleteGrocyProductGroup: deleteGroupDep,
        listGrocyProducts: vi.fn(async () => [
          { id: 77, name: 'Peas', product_group_id: 5 },
        ] as any),
      },
    );

    expect(result).toEqual({
      deleted: false,
      blocked: true,
      productGroupId: 5,
      name: 'Frozen',
      blockers: [
        {
          source: 'grocy_product_group_assignment',
          reference: 'grocy-product:77',
          message: 'Grocy product "Peas" is still assigned to this product group.',
        },
      ],
    });
    expect(deleteGroupDep).not.toHaveBeenCalled();
  });
});
