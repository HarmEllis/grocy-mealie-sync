import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeUnits, normalizeProducts } from '../normalize';
import { RecipesUnitsService, RecipesFoodsService } from '../../mealie';
import { getGrocyEntities, updateGrocyEntity } from '../../grocy/types';
import { db } from '../../db';

vi.mock('../../mealie', () => ({
  RecipesUnitsService: {
    getAllApiUnitsGet: vi.fn(),
    updateOneApiUnitsItemIdPut: vi.fn(),
  },
  RecipesFoodsService: {
    getAllApiFoodsGet: vi.fn(),
    updateOneApiFoodsItemIdPut: vi.fn(),
  }
}));

vi.mock('../../grocy/types', () => ({
  getGrocyEntities: vi.fn(),
  updateGrocyEntity: vi.fn(),
}));

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock('../../logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('normalize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeUnits', () => {
    it('updates Mealie units to lowercase', async () => {
      vi.mocked(RecipesUnitsService.getAllApiUnitsGet).mockResolvedValue({
        items: [
          { id: 'unit-1', name: 'GRAM', abbreviation: 'G' },
          { id: 'unit-2', name: '  LITER  ', abbreviation: '  L  ' },
        ],
        page: 1,
        per_page: 100,
        total: 2,
        total_pages: 1,
      } as any);

      vi.mocked(getGrocyEntities).mockResolvedValue([]);
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      } as any);

      await normalizeUnits();

      expect(RecipesUnitsService.updateOneApiUnitsItemIdPut).toHaveBeenCalledWith('unit-1', expect.objectContaining({
        name: 'gram',
        abbreviation: 'g',
      }));
      expect(RecipesUnitsService.updateOneApiUnitsItemIdPut).toHaveBeenCalledWith('unit-2', expect.objectContaining({
        name: 'liter',
        abbreviation: 'l',
      }));
    });
  });

  describe('normalizeProducts', () => {
    it('updates Mealie products to start with a capital letter and trims whitespace', async () => {
      vi.mocked(RecipesFoodsService.getAllApiFoodsGet).mockResolvedValue({
        items: [
          { id: 'food-1', name: 'apple', pluralName: 'apples' },
          { id: 'food-2', name: '  banana  ', pluralName: '  bananas  ' },
        ],
        page: 1,
        per_page: 100,
        total: 2,
        total_pages: 1,
      } as any);

      vi.mocked(getGrocyEntities).mockResolvedValue([]);
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      } as any);

      await normalizeProducts();

      expect(RecipesFoodsService.updateOneApiFoodsItemIdPut).toHaveBeenCalledWith('food-1', expect.objectContaining({
        name: 'Apple',
        pluralName: 'Apples',
      }));
      expect(RecipesFoodsService.updateOneApiFoodsItemIdPut).toHaveBeenCalledWith('food-2', expect.objectContaining({
        name: 'Banana',
        pluralName: 'Bananas',
      }));
    });
  });
});

