import { describe, expect, it } from 'vitest';
import { effectiveMappings, type Mapping } from '../products/types';
import type { TargetOption } from '@/lib/shop/targets';

const target: TargetOption = { kind: 'grocy_product', id: '1', name: 'Melk', source: 'grocy_mealie', linkedFoods: [{ id: 'food', name: 'Melk' }], baseUnitId: '10', baseUnitName: 'liter' };
const mapping = (id: string, overrides: Partial<Mapping>): Mapping => ({
  id, providerId: 'ah', retailerProductId: id, retailerProductName: id, targetKind: 'grocy_product', targetId: '1', targetName: 'Melk', role: 'preferred',
  packageBaseAmount: 1, packageBaseUnitId: '10', packageBaseUnitName: 'liter', confirmed: true, ...overrides,
});

describe('effectiveMappings', () => {
  it('picks the direct preferred mapping and lists a shadowed legacy preferred one as an alternative', () => {
    const direct = mapping('direct', {});
    const legacy = mapping('legacy', { targetKind: 'mealie_food', targetId: 'food' });
    const alt = mapping('alt', { role: 'alternative' });
    const result = effectiveMappings([legacy, direct, alt], 'ah', target);
    expect(result.main?.id).toBe('direct');
    expect(result.alternatives.map(item => item.id).sort()).toEqual(['alt', 'legacy']);
  });

  it('falls back to the legacy mapping when it is the only preferred one, and scopes by provider', () => {
    const legacy = mapping('legacy', { targetKind: 'mealie_food', targetId: 'food' });
    expect(effectiveMappings([legacy], 'ah', target).main?.id).toBe('legacy');
    expect(effectiveMappings([legacy], 'jumbo', target)).toEqual({ main: undefined, alternatives: [] });
  });
});
