import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  records: [] as Array<{ stateData: string }>,
  envOverrides: {
    stockOnlyMinStock: false,
  },
  stockOnlyMinStock: false,
}));

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mockState.records,
        }),
      }),
    }),
    insert: vi.fn(),
  },
}));

vi.mock('../config', () => ({
  config: {
    envOverrides: {
      get stockOnlyMinStock() {
        return mockState.envOverrides.stockOnlyMinStock;
      },
    },
    get stockOnlyMinStock() {
      return mockState.stockOnlyMinStock;
    },
  },
}));

vi.mock('../logger', () => ({
  log: {
    error: vi.fn(),
  },
}));

import { getSettings, resolveStockOnlyMinStock } from '../settings';

describe('settings defaults', () => {
  beforeEach(() => {
    mockState.records = [];
    mockState.envOverrides.stockOnlyMinStock = false;
    mockState.stockOnlyMinStock = false;
  });

  it('defaults stockOnlyMinStock to true on a fresh install when no settings record exists', async () => {
    const settings = await getSettings();

    expect(settings.stockOnlyMinStock).toBe(true);
  });

  it('defaults stockOnlyMinStock to true for existing settings records that predate the flag', async () => {
    mockState.records = [{
      stateData: JSON.stringify({
        autoCreateProducts: true,
      }),
    }];

    const settings = await getSettings();

    expect(settings.stockOnlyMinStock).toBe(true);
  });

  it('still honors an explicit env override on a fresh install', async () => {
    mockState.envOverrides.stockOnlyMinStock = true;
    mockState.stockOnlyMinStock = false;

    const effectiveValue = await resolveStockOnlyMinStock();

    expect(effectiveValue).toBe(false);
  });
});
