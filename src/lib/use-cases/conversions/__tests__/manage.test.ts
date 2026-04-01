import { describe, expect, it, vi } from 'vitest';
import {
  createUnitConversion,
  deleteUnitConversion,
  listConversions,
} from '../manage';

describe('unit conversion use-cases', () => {
  it('lists all conversions with unit names resolved', async () => {
    const result = await listConversions({
      listGrocyConversions: vi.fn(async () => [
        { id: 1, from_qu_id: 1, to_qu_id: 2, factor: 1, product_id: null },
        { id: 2, from_qu_id: 1, to_qu_id: 3, factor: 0.5, product_id: 10 },
      ]),
      listGrocyUnits: vi.fn(async () => [
        { id: 1, name: 'Zak' },
        { id: 2, name: 'Pak' },
        { id: 3, name: 'Stuk' },
      ]),
    });

    expect(result).toEqual({
      conversions: [
        {
          id: 1,
          fromUnitId: 1,
          fromUnitName: 'Zak',
          toUnitId: 2,
          toUnitName: 'Pak',
          factor: 1,
          grocyProductId: null,
        },
        {
          id: 2,
          fromUnitId: 1,
          fromUnitName: 'Zak',
          toUnitId: 3,
          toUnitName: 'Stuk',
          factor: 0.5,
          grocyProductId: 10,
        },
      ],
    });
  });

  it('handles unknown unit ids gracefully', async () => {
    const result = await listConversions({
      listGrocyConversions: vi.fn(async () => [
        { id: 3, from_qu_id: 99, to_qu_id: 100, factor: 2, product_id: null },
      ]),
      listGrocyUnits: vi.fn(async () => []),
    });

    expect(result).toEqual({
      conversions: [
        {
          id: 3,
          fromUnitId: 99,
          fromUnitName: 'Unknown',
          toUnitId: 100,
          toUnitName: 'Unknown',
          factor: 2,
          grocyProductId: null,
        },
      ],
    });
  });

  it('returns an empty list when no conversions exist', async () => {
    const result = await listConversions({
      listGrocyConversions: vi.fn(async () => []),
      listGrocyUnits: vi.fn(async () => []),
    });

    expect(result).toEqual({
      conversions: [],
    });
  });

  it('creates a global unit conversion', async () => {
    const createGrocyEntity = vi.fn(async () => ({ created_object_id: 42 }));
    const listGrocyConversions = vi.fn(async () => []);

    const result = await createUnitConversion(
      {
        fromGrocyUnitId: 1,
        toGrocyUnitId: 2,
        factor: 1,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyConversions,
        createGrocyConversion: createGrocyEntity,
      },
    );

    expect(createGrocyEntity).toHaveBeenCalledWith({
      from_qu_id: 1,
      to_qu_id: 2,
      factor: 1,
    });
    expect(result).toEqual({
      created: true,
      conversionId: 42,
      fromGrocyUnitId: 1,
      toGrocyUnitId: 2,
      factor: 1,
      grocyProductId: null,
    });
  });

  it('creates a product-specific unit conversion', async () => {
    const createGrocyEntity = vi.fn(async () => ({ created_object_id: 43 }));
    const listGrocyConversions = vi.fn(async () => []);

    const result = await createUnitConversion(
      {
        fromGrocyUnitId: 1,
        toGrocyUnitId: 2,
        factor: 2.5,
        grocyProductId: 10,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyConversions,
        createGrocyConversion: createGrocyEntity,
      },
    );

    expect(createGrocyEntity).toHaveBeenCalledWith({
      from_qu_id: 1,
      to_qu_id: 2,
      factor: 2.5,
      product_id: 10,
    });
    expect(result).toEqual({
      created: true,
      conversionId: 43,
      fromGrocyUnitId: 1,
      toGrocyUnitId: 2,
      factor: 2.5,
      grocyProductId: 10,
    });
  });

  it('skips creation when the same from→to conversion already exists', async () => {
    const createGrocyEntity = vi.fn();
    const listGrocyConversions = vi.fn(async () => [
      { id: 5, from_qu_id: 1, to_qu_id: 2, factor: 1, product_id: null },
    ]);

    const result = await createUnitConversion(
      {
        fromGrocyUnitId: 1,
        toGrocyUnitId: 2,
        factor: 1,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyConversions,
        createGrocyConversion: createGrocyEntity,
      },
    );

    expect(createGrocyEntity).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: false,
      conversionId: 5,
      fromGrocyUnitId: 1,
      toGrocyUnitId: 2,
      factor: 1,
      grocyProductId: null,
      duplicateCheck: {
        skipped: true,
        existingConversionId: 5,
      },
    });
  });

  it('skips creation when the reverse to→from conversion already exists', async () => {
    const createGrocyEntity = vi.fn();
    const listGrocyConversions = vi.fn(async () => [
      { id: 6, from_qu_id: 2, to_qu_id: 1, factor: 1, product_id: null },
    ]);

    const result = await createUnitConversion(
      {
        fromGrocyUnitId: 1,
        toGrocyUnitId: 2,
        factor: 1,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyConversions,
        createGrocyConversion: createGrocyEntity,
      },
    );

    expect(createGrocyEntity).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: false,
      conversionId: 6,
      fromGrocyUnitId: 1,
      toGrocyUnitId: 2,
      factor: 1,
      grocyProductId: null,
      duplicateCheck: {
        skipped: true,
        existingConversionId: 6,
        reverseConversion: true,
      },
    });
  });

  it('distinguishes global from product-specific duplicates', async () => {
    const createGrocyEntity = vi.fn(async () => ({ created_object_id: 44 }));
    const listGrocyConversions = vi.fn(async () => [
      { id: 5, from_qu_id: 1, to_qu_id: 2, factor: 1, product_id: null },
    ]);

    const result = await createUnitConversion(
      {
        fromGrocyUnitId: 1,
        toGrocyUnitId: 2,
        factor: 1,
        grocyProductId: 10,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyConversions,
        createGrocyConversion: createGrocyEntity,
      },
    );

    expect(createGrocyEntity).toHaveBeenCalled();
    expect(result.created).toBe(true);
  });

  it('deletes a unit conversion by id', async () => {
    const deleteGrocyEntity = vi.fn(async () => undefined);

    const result = await deleteUnitConversion(
      { conversionId: 42 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        deleteGrocyConversion: deleteGrocyEntity,
      },
    );

    expect(deleteGrocyEntity).toHaveBeenCalledWith(42);
    expect(result).toEqual({
      deleted: true,
      conversionId: 42,
    });
  });
});
