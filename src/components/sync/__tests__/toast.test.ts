import { describe, expect, it } from 'vitest';
import { ENSURE_LOW_STOCK_ENDPOINT, getPartialToastConfig, hasSyncActionError } from '../toast';

describe('getPartialToastConfig', () => {
  it('points ensure partial results with unmapped products to the mapping wizard', () => {
    expect(getPartialToastConfig(ENSURE_LOW_STOCK_ENDPOINT, {
      status: 'partial',
      message: 'Ensured 2 low-stock products in Mealie. Skipped 1 product because it is not mapped.',
      summary: {
        processedProducts: 3,
        ensuredProducts: 2,
        unmappedProducts: 1,
      },
    })).toEqual({
      description: 'Ensured 2 low-stock products in Mealie. Skipped 1 product because it is not mapped. Open Mapping Wizard > Grocy Min Stock to map them.',
      duration: 12000,
      mappingWizardTab: 'grocy-min-stock',
    });
  });

  it('keeps generic partial descriptions for other sync actions', () => {
    expect(getPartialToastConfig('/api/sync/products', {
      status: 'partial',
      message: 'Synced 1 item.',
      summary: {
        processedProducts: 1,
      },
    })).toEqual({
      description: 'Synced 1 item.',
    });
  });

  it('treats a JSON body with status=error as an error even on a 2xx response', () => {
    expect(hasSyncActionError(true, {
      status: 'error',
      message: 'Backend reported an error',
    })).toBe(true);
  });
});
