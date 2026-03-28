import { describe, expect, it } from 'vitest';
import {
  suggestProductMappings,
  suggestUnitMappings,
  type MappingSuggestionDeps,
} from '../suggestions';

function createDeps(overrides: Partial<MappingSuggestionDeps> = {}): MappingSuggestionDeps {
  return {
    listProductMappings: async () => [],
    listUnitMappings: async () => [
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
    ],
    listGrocyProducts: async () => [
      { id: 101, name: 'Milk', qu_id_purchase: 10 },
      { id: 202, name: 'Butter', qu_id_purchase: 20 },
    ],
    listGrocyUnits: async () => [
      { id: 10, name: 'Litre', name_plural: 'Litres', plural_forms: 'liter;liters' },
      { id: 20, name: 'Pack', name_plural: 'Packs', plural_forms: 'pack;packs' },
    ],
    listMealieFoods: async () => [
      { id: 'food-1', name: 'Whole Milk', pluralName: 'Whole Milks', aliases: ['Milk'] },
      { id: 'food-2', name: 'Butter', pluralName: 'Butters', aliases: [] },
    ],
    listMealieUnits: async () => [
      { id: 'unit-1', name: 'Liter', pluralName: 'Liters', abbreviation: 'l', pluralAbbreviation: 'ls', aliases: ['litre'] },
      { id: 'unit-2', name: 'Packet', pluralName: 'Packets', abbreviation: 'pkt', pluralAbbreviation: 'pkts', aliases: ['pack'] },
    ],
    ...overrides,
  };
}

describe('mapping suggestions', () => {
  it('suggests likely product mappings for unmapped Mealie foods', async () => {
    const result = await suggestProductMappings(createDeps());

    expect(result).toEqual({
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
    });
  });

  it('suggests likely unit mappings for unmapped Mealie units', async () => {
    const result = await suggestUnitMappings(createDeps());

    expect(result).toEqual({
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
    });
  });
});
