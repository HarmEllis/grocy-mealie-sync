import { describe, it, expect } from 'vitest';
import {
  productSyncRequestSchema,
  productCreateRequestSchema,
  unitSyncRequestSchema,
  unitCreateRequestSchema,
  settingsUpdateSchema,
  orphanDeleteRequestSchema,
} from '../validation';

describe('productSyncRequestSchema', () => {
  it('accepts valid input', () => {
    const result = productSyncRequestSchema.safeParse({
      mappings: [{ mealieFoodId: 'abc', grocyProductId: 1, grocyUnitId: 2 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing fields', () => {
    const result = productSyncRequestSchema.safeParse({
      mappings: [{ mealieFoodId: 'abc' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects wrong types', () => {
    const result = productSyncRequestSchema.safeParse({
      mappings: [{ mealieFoodId: 123, grocyProductId: 'not a number', grocyUnitId: 2 }],
    });
    expect(result.success).toBe(false);
  });

  it('enforces max 500 items', () => {
    const tooMany = Array.from({ length: 501 }, (_, i) => ({
      mealieFoodId: `id-${i}`,
      grocyProductId: i,
      grocyUnitId: 1,
    }));
    const result = productSyncRequestSchema.safeParse({ mappings: tooMany });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 500 items', () => {
    const maxItems = Array.from({ length: 500 }, (_, i) => ({
      mealieFoodId: `id-${i}`,
      grocyProductId: i,
      grocyUnitId: 1,
    }));
    const result = productSyncRequestSchema.safeParse({ mappings: maxItems });
    expect(result.success).toBe(true);
  });
});

describe('productCreateRequestSchema', () => {
  it('accepts valid input with optional unitOverrides', () => {
    const result = productCreateRequestSchema.safeParse({
      mealieFoodIds: ['a', 'b'],
      defaultGrocyUnitId: 3,
      unitOverrides: { a: 5 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input without unitOverrides', () => {
    const result = productCreateRequestSchema.safeParse({
      mealieFoodIds: ['a'],
      defaultGrocyUnitId: 3,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing defaultGrocyUnitId', () => {
    const result = productCreateRequestSchema.safeParse({
      mealieFoodIds: ['a'],
    });
    expect(result.success).toBe(false);
  });
});

describe('unitSyncRequestSchema', () => {
  it('accepts valid input', () => {
    const result = unitSyncRequestSchema.safeParse({
      mappings: [{ mealieUnitId: 'u1', grocyUnitId: 10 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty mappings value', () => {
    const result = unitSyncRequestSchema.safeParse({ mappings: 'not an array' });
    expect(result.success).toBe(false);
  });
});

describe('unitCreateRequestSchema', () => {
  it('accepts valid input', () => {
    const result = unitCreateRequestSchema.safeParse({
      mealieUnitIds: ['u1', 'u2'],
    });
    expect(result.success).toBe(true);
  });

  it('enforces max 500 items', () => {
    const result = unitCreateRequestSchema.safeParse({
      mealieUnitIds: Array.from({ length: 501 }, (_, i) => `u-${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe('settingsUpdateSchema', () => {
  it('accepts partial updates', () => {
    const result = settingsUpdateSchema.safeParse({
      autoCreateProducts: true,
      ensureLowStockOnMealieList: true,
      syncMealieInPossession: true,
      mealieInPossessionOnlyAboveMinStock: true,
      allowDecimalMinStockInMappingWizard: false,
      stockOnlyMinStock: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null for nullable fields', () => {
    const result = settingsUpdateSchema.safeParse({
      defaultUnitMappingId: null,
      mealieShoppingListId: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = settingsUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects wrong boolean type', () => {
    const result = settingsUpdateSchema.safeParse({
      stockOnlyMinStock: 'yes',
    });
    expect(result.success).toBe(false);
  });
});

describe('orphanDeleteRequestSchema', () => {
  it('requires confirm: true and ids array', () => {
    const result = orphanDeleteRequestSchema.safeParse({
      confirm: true,
      ids: ['1', '2'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects confirm: false', () => {
    const result = orphanDeleteRequestSchema.safeParse({
      confirm: false,
      ids: ['1'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing confirm', () => {
    const result = orphanDeleteRequestSchema.safeParse({
      ids: ['1'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing ids', () => {
    const result = orphanDeleteRequestSchema.safeParse({
      confirm: true,
    });
    expect(result.success).toBe(false);
  });
});
