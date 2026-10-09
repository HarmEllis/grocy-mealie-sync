import { expect, it } from 'vitest';
import { catalogOptions, productLabel, type ShopProduct } from '../catalog-options';
const product = (externalId: string, availability: string, name = externalId): ShopProduct => ({ providerId: 'ah', externalId, name, availability, packageAmount: 250, packageUnit: 'g', measure: 'unit' });
it('hides discontinued choices, keeps temporary shortages and unknown products, and prioritizes suggestions', () => {
  const choices = [product('old', 'discontinued'), product('stock', 'temporarily_unavailable'), product('new', 'unknown'), product('a', 'available')];
  expect(catalogOptions(choices, 'ah', '', new Set(['new'])).map(option => option.value)).toEqual(['new', 'a', 'stock']);
  expect(catalogOptions(choices, 'picnic', '')).toEqual([]);
  expect(productLabel(choices[1])).toContain('temporarily out of stock');
  expect(catalogOptions(choices, 'ah', 'stock')[0].label).toContain('250 g');
});
it('preserves known products when a new search omits them and sorts names naturally', () => {
  expect(catalogOptions([product('1', 'available', 'Product 10'), product('2', 'available', 'Product 2')], 'ah', '').map(option => option.value)).toEqual(['2', '1']);
});
