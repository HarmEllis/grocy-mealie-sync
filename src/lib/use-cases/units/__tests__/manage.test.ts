import { describe, expect, it, vi } from 'vitest';
import {
  compareUnits,
  createGrocyUnit,
  createMealieUnit,
  getUnitCatalog,
  updateGrocyUnitMetadata,
  updateMealieUnitMetadata,
} from '../manage';

describe('unit management use-cases', () => {
  it('returns a combined unit catalog with mapping references', async () => {
    const result = await getUnitCatalog({
      listGrocyUnits: vi.fn(async () => [
        { id: 10, name: 'Litre', name_plural: 'Litres', plural_forms: 'liter;liters' },
      ]),
      listMealieUnits: vi.fn(async () => [
        {
          id: 'unit-1',
          name: 'Liter',
          pluralName: 'Liters',
          abbreviation: 'l',
          pluralAbbreviation: 'ls',
          aliases: [{ name: 'litre' }],
        },
      ]),
      listUnitMappings: vi.fn(async () => [
        {
          id: 'unit-map-1',
          mealieUnitId: 'unit-1',
          mealieUnitName: 'Liter',
          mealieUnitAbbreviation: 'l',
          grocyUnitId: 10,
          grocyUnitName: 'Litre',
          conversionFactor: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    });

    expect(result).toEqual({
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
  });

  it('updates Grocy unit metadata including plural forms', async () => {
    const updateGrocyUnit = vi.fn(async () => undefined);

    const result = await updateGrocyUnitMetadata(
      {
        grocyUnitId: 10,
        name: 'Can',
        pluralName: 'Cans',
        pluralForms: ['tin', 'tins'],
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        updateGrocyUnit,
      },
    );

    expect(updateGrocyUnit).toHaveBeenCalledWith(10, {
      name: 'Can',
      name_plural: 'Cans',
      plural_forms: 'tin\ntins',
    });
    expect(result).toEqual({
      grocyUnitId: 10,
      updated: {
        name: 'Can',
        pluralName: 'Cans',
        pluralForms: ['tin', 'tins'],
      },
    });
  });

  it('creates a new Grocy unit and keeps plural metadata together', async () => {
    const createGrocyUnitDep = vi.fn(async () => ({ createdObjectId: 12 }));

    const result = await createGrocyUnit(
      {
        name: 'Can',
        pluralName: 'Cans',
        pluralForms: ['tin', 'tins', 'tins'],
        description: 'Metal container',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyUnits: vi.fn(async () => [
          { id: 10, name: 'Bottle' },
        ]),
        createGrocyUnit: createGrocyUnitDep,
      },
    );

    expect(createGrocyUnitDep).toHaveBeenCalledWith({
      name: 'Can',
      name_plural: 'Cans',
      description: 'Metal container',
      plural_forms: 'tin\ntins',
    });
    expect(result).toEqual({
      created: true,
      grocyUnitId: 12,
      grocyUnitName: 'Can',
      duplicateCheck: {
        skipped: false,
        exactGrocyMatches: 0,
      },
    });
  });

  it('skips Grocy unit creation when an exact unit name already exists', async () => {
    const createGrocyUnitDep = vi.fn();

    const result = await createGrocyUnit(
      {
        name: 'Can',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listGrocyUnits: vi.fn(async () => [
          { id: 10, name: 'can' },
          { id: 11, name: 'Can' },
        ]),
        createGrocyUnit: createGrocyUnitDep,
      },
    );

    expect(createGrocyUnitDep).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: false,
      grocyUnitId: 10,
      grocyUnitName: 'can',
      duplicateCheck: {
        skipped: true,
        exactGrocyMatches: 2,
      },
    });
  });

  it('updates Mealie unit metadata by merging onto the current Mealie unit payload', async () => {
    const updateMealieUnit = vi.fn(async () => undefined);

    const result = await updateMealieUnitMetadata(
      {
        mealieUnitId: 'unit-1',
        name: 'tablespoon',
        pluralName: 'tablespoons',
        abbreviation: 'tbsp',
        pluralAbbreviation: 'tbsps',
        aliases: ['eetlepel'],
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getMealieUnit: vi.fn(async () => ({
          id: 'unit-1',
          name: 'Tablespoon',
          pluralName: 'Tablespoons',
          description: 'Volume unit',
          extras: { system: 'imperial' },
          fraction: true,
          abbreviation: 'TBSP',
          pluralAbbreviation: 'TBSPS',
          useAbbreviation: true,
          aliases: [],
        })),
        updateMealieUnit,
      },
    );

    expect(updateMealieUnit).toHaveBeenCalledWith('unit-1', {
      id: 'unit-1',
      name: 'tablespoon',
      pluralName: 'tablespoons',
      description: 'Volume unit',
      extras: { system: 'imperial' },
      fraction: true,
      abbreviation: 'tbsp',
      pluralAbbreviation: 'tbsps',
      useAbbreviation: true,
      aliases: [{ name: 'eetlepel' }],
    });
    expect(result).toEqual({
      mealieUnitId: 'unit-1',
      updated: {
        name: 'tablespoon',
        pluralName: 'tablespoons',
        abbreviation: 'tbsp',
        pluralAbbreviation: 'tbsps',
        aliases: ['eetlepel'],
      },
    });
  });

  it('creates a new Mealie unit with aliases and abbreviation defaults', async () => {
    const createMealieUnitDep = vi.fn(async () => ({
      id: 'unit-9',
      name: 'Tablespoon',
    }));

    const result = await createMealieUnit(
      {
        name: 'Tablespoon',
        pluralName: 'Tablespoons',
        abbreviation: 'tbsp',
        pluralAbbreviation: 'tbsps',
        aliases: ['eetlepel', ' tablespoon ', 'eetlepel'],
        description: 'Volume unit',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listMealieUnits: vi.fn(async () => [
          { id: 'unit-1', name: 'Liter' },
        ] as any),
        createMealieUnit: createMealieUnitDep,
      },
    );

    expect(createMealieUnitDep).toHaveBeenCalledWith({
      name: 'Tablespoon',
      pluralName: 'Tablespoons',
      description: 'Volume unit',
      abbreviation: 'tbsp',
      pluralAbbreviation: 'tbsps',
      fraction: undefined,
      useAbbreviation: true,
      aliases: [{ name: 'eetlepel' }, { name: 'tablespoon' }],
    });
    expect(result).toEqual({
      created: true,
      mealieUnitId: 'unit-9',
      mealieUnitName: 'Tablespoon',
      duplicateCheck: {
        skipped: false,
        exactMealieMatches: 0,
      },
    });
  });

  it('skips Mealie unit creation when an exact unit name already exists', async () => {
    const createMealieUnitDep = vi.fn();

    const result = await createMealieUnit(
      {
        name: 'Cup',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        listMealieUnits: vi.fn(async () => [
          { id: 'unit-3', name: 'cup' },
        ] as any),
        createMealieUnit: createMealieUnitDep,
      },
    );

    expect(createMealieUnitDep).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: false,
      mealieUnitId: 'unit-3',
      mealieUnitName: 'cup',
      duplicateCheck: {
        skipped: true,
        exactMealieMatches: 1,
      },
    });
  });

  it('compares one Mealie unit against one Grocy unit', async () => {
    const result = await compareUnits(
      {
        mealieUnitId: 'unit-1',
        grocyUnitId: 10,
      },
      {
        getMealieUnit: vi.fn(async () => ({
          id: 'unit-1',
          name: 'Liter',
          pluralName: 'Liters',
          abbreviation: 'l',
          pluralAbbreviation: 'ls',
          aliases: [{ name: 'litre' }],
        })),
        getGrocyUnit: vi.fn(async () => ({
          id: 10,
          name: 'Litre',
          name_plural: 'Litres',
          plural_forms: 'liter;liters',
        })),
        listUnitMappings: vi.fn(async () => [
          {
            id: 'unit-map-1',
            mealieUnitId: 'unit-1',
            mealieUnitName: 'Liter',
            mealieUnitAbbreviation: 'l',
            grocyUnitId: 10,
            grocyUnitName: 'Litre',
            conversionFactor: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      },
    );

    expect(result).toEqual({
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
    });
  });
});
