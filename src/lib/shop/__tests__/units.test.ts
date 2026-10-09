import { describe, expect, it } from 'vitest';
import { emptyUnitContext, grocyQuFactor, resolveCheckOffAmount, type UnitContext } from '../units';

// Grocy unit IDs as in a typical install.
const STUK = 2;
const PAK = 3;
const VERPAKKING = 8;
const ZAK = 9;
const DOOS = 11;
const BLIK = 13;
const KG = 14;
const GRAM = 15;

function context(): UnitContext {
  const ctx = emptyUnitContext();
  for (const [id, name] of [[STUK, 'Stuk'], [PAK, 'pak'], [VERPAKKING, 'verpakking'], [ZAK, 'zak'], [DOOS, 'Doos'], [BLIK, 'blik'], [KG, 'kilogram'], [GRAM, 'gram']] as const) {
    ctx.grocyUnitNames.set(id, name);
  }
  const product = (id: number, quIdStock: number, quIdPurchase: number) => {
    ctx.grocyProducts.set(id, { id, name: `Product ${id}`, quIdStock, quIdPurchase, parentProductId: null, noOwnStock: false });
  };
  product(58, BLIK, BLIK); // chickpeas: 1 can = 400 g
  product(56, ZAK, ZAK); // flour: 1 bag = 1000 g
  product(67, ZAK, ZAK); // orzo: 1 bag = 500 g
  product(30, STUK, DOOS); // eggs: stocked per piece, bought per box of 12
  product(55, PAK, VERPAKKING); // coconut milk: stocked per pack, bought per package
  product(79, DOOS, DOOS); // cherry tomatoes: stocked and bought per box
  ctx.grocyConversions.push(
    { fromQuId: KG, toQuId: GRAM, factor: 1000, productId: null },
    { fromQuId: GRAM, toQuId: KG, factor: 0.001, productId: null },
    { fromQuId: BLIK, toQuId: GRAM, factor: 400, productId: 58 },
    { fromQuId: GRAM, toQuId: BLIK, factor: 0.0025, productId: 58 },
    { fromQuId: ZAK, toQuId: GRAM, factor: 1000, productId: 56 },
    { fromQuId: ZAK, toQuId: GRAM, factor: 500, productId: 67 },
    { fromQuId: DOOS, toQuId: STUK, factor: 12, productId: 30 },
    { fromQuId: VERPAKKING, toQuId: PAK, factor: 1, productId: 55 },
  );
  ctx.unitMappings.set('mealie-gram', { grocyUnitId: GRAM, factor: 1 });
  ctx.unitMappings.set('mealie-kg', { grocyUnitId: KG, factor: 1 });
  ctx.unitMappings.set('mealie-blik', { grocyUnitId: BLIK, factor: 1 });
  ctx.unitMappings.set('mealie-zak', { grocyUnitId: ZAK, factor: 1 });
  ctx.unitMappings.set('mealie-pak', { grocyUnitId: PAK, factor: 1 });
  ctx.unitMappings.set('mealie-verpakking', { grocyUnitId: VERPAKKING, factor: 1 });
  return ctx;
}

describe('grocyQuFactor', () => {
  it('uses a direct or inverse product conversion', () => {
    const ctx = context();
    expect(grocyQuFactor(ctx, 58, GRAM, BLIK)).toBe(0.0025);
    expect(grocyQuFactor(ctx, 56, GRAM, ZAK)).toBe(0.001);
  });

  it('chains through one intermediate unit', () => {
    // kg -> g (global) -> bag (product): 1 kg flour = 1 bag, 1 kg orzo = 2 bags.
    expect(grocyQuFactor(context(), 56, KG, ZAK)).toBeCloseTo(1, 12);
    expect(grocyQuFactor(context(), 67, KG, ZAK)).toBeCloseTo(2, 12);
  });

  it('never chains through two intermediate units', () => {
    const ctx = context();
    ctx.grocyConversions.push({ fromQuId: 99, toQuId: KG, factor: 1, productId: null });
    // 99 -> kg -> g -> can needs two intermediates.
    expect(grocyQuFactor(ctx, 58, 99, BLIK)).toBeNull();
  });

  it('prefers a product conversion over a global one', () => {
    const ctx = context();
    ctx.grocyConversions.push({ fromQuId: BLIK, toQuId: GRAM, factor: 999, productId: null });
    expect(grocyQuFactor(ctx, 58, BLIK, GRAM)).toBe(400);
  });

  it('returns null for conflicting records instead of picking one', () => {
    const ctx = context();
    ctx.grocyConversions.push({ fromQuId: GRAM, toQuId: BLIK, factor: 0.005, productId: 58 });
    expect(grocyQuFactor(ctx, 58, GRAM, BLIK)).toBeNull();
  });

  it('does not fall back to a global conversion when the product records conflict', () => {
    const ctx = context();
    ctx.grocyConversions.push(
      { fromQuId: BLIK, toQuId: GRAM, factor: 200, productId: 58 },
      { fromQuId: BLIK, toQuId: GRAM, factor: 400, productId: null },
    );
    expect(grocyQuFactor(ctx, 58, BLIK, GRAM)).toBeNull();
    expect(grocyQuFactor(ctx, 58, KG, BLIK)).toBeNull();
  });

  it('is independent of record order', () => {
    const ctx = context();
    ctx.grocyConversions.reverse();
    expect(grocyQuFactor(ctx, 67, KG, ZAK)).toBeCloseTo(2, 12);
  });

  it('returns null when intermediate paths disagree', () => {
    const ctx = context();
    // A second route from kg to a bag of orzo through a made-up unit 98 that disagrees.
    ctx.grocyConversions.push(
      { fromQuId: KG, toQuId: 98, factor: 1, productId: 67 },
      { fromQuId: 98, toQuId: ZAK, factor: 5, productId: 67 },
    );
    expect(grocyQuFactor(ctx, 67, KG, ZAK)).toBeNull();
  });

  it('ignores invalid factors', () => {
    const ctx = emptyUnitContext();
    ctx.grocyConversions.push({ fromQuId: KG, toQuId: GRAM, factor: Number.POSITIVE_INFINITY, productId: null });
    expect(grocyQuFactor(ctx, 1, KG, GRAM)).toBeNull();
  });
});

describe('resolveCheckOffAmount', () => {
  it('converts recipe amounts into the stock unit', () => {
    const ctx = context();
    expect(resolveCheckOffAmount(ctx, 58, 400, 'mealie-gram')).toMatchObject({ ok: true, amount: 1 });
    expect(resolveCheckOffAmount(ctx, 67, 300, 'mealie-gram')).toMatchObject({ ok: true, amount: 0.6 });
    expect(resolveCheckOffAmount(ctx, 67, 1, 'mealie-kg')).toMatchObject({ ok: true, amount: 2 });
  });

  it('books rows in the stock unit as they are', () => {
    expect(resolveCheckOffAmount(context(), 58, 3, 'mealie-blik')).toEqual({ ok: true, amount: 3, factor: 1 });
    expect(resolveCheckOffAmount(context(), 55, 2, 'mealie-pak')).toEqual({ ok: true, amount: 2, factor: 1 });
  });

  it('applies the unit mapping factor', () => {
    const ctx = context();
    ctx.unitMappings.set('mealie-six-pack', { grocyUnitId: BLIK, factor: 6 });
    expect(resolveCheckOffAmount(ctx, 58, 2, 'mealie-six-pack')).toEqual({ ok: true, amount: 12, factor: 6 });
  });

  it('treats an empty unit as the stock unit when purchase and stock agree or the stock unit counts pieces', () => {
    const ctx = context();
    expect(resolveCheckOffAmount(ctx, 79, 2, null)).toEqual({ ok: true, amount: 2, factor: 1 });
    // Eggs: stocked per piece, so "10" without a unit means ten eggs.
    expect(resolveCheckOffAmount(ctx, 30, 10, null)).toEqual({ ok: true, amount: 10, factor: 1 });
  });

  it('refuses an empty unit when it could mean the purchase unit', () => {
    // Coconut milk is stocked per pack (a mapped unit) and bought per package.
    expect(resolveCheckOffAmount(context(), 55, 2, null)).toEqual({ ok: false, reason: 'missing_unit' });
  });

  it('refuses rows in a purchase unit that differs from the stock unit', () => {
    expect(resolveCheckOffAmount(context(), 55, 1, 'mealie-verpakking')).toEqual({ ok: false, reason: 'purchase_unit_ambiguous' });
  });

  it('refuses units without a known conversion', () => {
    const ctx = context();
    expect(resolveCheckOffAmount(ctx, 58, 2, 'mealie-eetlepel')).toEqual({ ok: false, reason: 'no_conversion' });
    expect(resolveCheckOffAmount(ctx, 30, 400, 'mealie-gram')).toEqual({ ok: false, reason: 'no_conversion' });
    expect(resolveCheckOffAmount(ctx, 999, 1, null)).toEqual({ ok: false, reason: 'unknown_product' });
  });

  it('refuses amounts that are not positive and finite', () => {
    const ctx = context();
    expect(resolveCheckOffAmount(ctx, 58, -1, 'mealie-blik')).toEqual({ ok: false, reason: 'invalid_amount' });
    expect(resolveCheckOffAmount(ctx, 58, Number.NaN, 'mealie-blik')).toEqual({ ok: false, reason: 'invalid_amount' });
    expect(resolveCheckOffAmount(ctx, 58, 0.0000001, 'mealie-gram')).toEqual({ ok: false, reason: 'invalid_amount' });
    ctx.unitMappings.set('mealie-broken', { grocyUnitId: BLIK, factor: Number.POSITIVE_INFINITY });
    expect(resolveCheckOffAmount(ctx, 58, 1, 'mealie-broken')).toEqual({ ok: false, reason: 'no_conversion' });
  });
});
