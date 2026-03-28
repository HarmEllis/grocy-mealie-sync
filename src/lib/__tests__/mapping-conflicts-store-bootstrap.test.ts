import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  dbRun: vi.fn(),
  selectFrom: vi.fn(async () => []),
}));

vi.mock('../db/schema', () => ({
  mappingConflicts: {},
  productMappings: {},
  unitMappings: {},
}));

vi.mock('../db', () => ({
  db: {
    run: mockState.dbRun,
    select: vi.fn(() => ({
      from: mockState.selectFrom,
    })),
  },
}));

vi.mock('../mealie', () => ({
  RecipesFoodsService: {
    getAllApiFoodsGet: vi.fn(),
  },
  RecipesUnitsService: {
    getAllApiUnitsGet: vi.fn(),
  },
}));

vi.mock('../mealie/types', () => ({
  extractFoods: vi.fn(),
  extractUnits: vi.fn(),
}));

vi.mock('../grocy/types', () => ({
  getGrocyEntities: vi.fn(),
}));

vi.mock('../mapping-conflicts-detection', () => ({
  detectMappingConflicts: vi.fn(),
}));

describe('mapping conflict store bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    mockState.dbRun.mockReset();
    mockState.selectFrom.mockClear();
  });

  it('ensures the conflict table exists before listing conflicts', async () => {
    const { listOpenMappingConflicts } = await import('../mapping-conflicts-store');

    await listOpenMappingConflicts();

    expect(mockState.dbRun).toHaveBeenCalled();
  });
});
