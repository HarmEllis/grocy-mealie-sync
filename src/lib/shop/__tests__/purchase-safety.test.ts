import { describe, expect, it } from 'vitest';
import { planReceipt, type PlannerDemand, type PlannerInput } from '../reconcile-planner';
import { derivePackageBaseAmount } from '../units';

function demand(overrides: Partial<PlannerDemand> = {}): PlannerDemand {
  return {
    mealieItemId: 'row', targetKind: 'grocy_product', targetId: '10',
    rowQuantity: 5, rowIdentity: 'milk-litre', rowFactor: 1,
    purchaseRevision: { revisionId: 'revision-before-purchase', identity: 'milk-litre', quantity: 5, checked: false },
    ownReductionsSincePurchase: 0, firstSeenAt: new Date('2026-10-01T10:00:00Z'), ...overrides,
  };
}
function input(row = demand()): PlannerInput {
  return {
    receipt: { id: 'receipt', purchasedAt: new Date('2026-10-02T10:00:00Z'), fetchedAt: new Date('2026-10-04T10:00:00Z') },
    lines: [{ id: 'line', lineNo: 1, kind: 'product', retailerProductId: 'milk', description: 'Milk', quantity: 3, unit: 'piece', amountCents: 600 }],
    mappings: new Map([['milk', { retailerProductId: 'milk', targetKind: 'grocy_product', targetId: '10', targetName: 'Milk', measure: 'unit', packageBaseAmount: 1, confirmed: true }]]),
    exportAllocations: [], lifecycles: [], demand: [row],
  };
}
describe('purchase-time safety', () => {
  it('leaves a row added after the purchase open and books the actual purchase as extra stock', () => {
    const result = planReceipt(input(demand({ purchaseRevision: null, firstSeenAt: new Date('2026-10-03T10:00:00Z') })));
    expect(result.reductions).toEqual([]);
    expect(result.lines[0]).toMatchObject({ bookAmount: 3, extraAmount: 3 });
  });
  it('does not fulfil a row whose food or unit changed after purchase', () => {
    const result = planReceipt(input(demand({ rowIdentity: 'bread-piece' })));
    expect(result.reductions).toEqual([]);
    expect(result.lines[0].bookAmount).toBe(3);
  });
  it('does not allocate an old receipt to demand added after our earlier fulfilment', () => {
    const result = planReceipt(input(demand({ rowQuantity: 5, ownReductionsSincePurchase: 5 })));
    expect(result.reductions).toEqual([]);
  });
  it('leaves the unpurchased remainder open', () => {
    const result = planReceipt(input());
    expect(result.reductions).toEqual([{ mealieItemId: 'row', rowQuantityBefore: 5, rowQuantityAfter: 2, rowIdentity: 'milk-litre', lineIds: ['line'] }]);
    expect(result.lines[0]).toMatchObject({ bookAmount: 3, extraAmount: 0 });
  });
  it('converts a weighed gram receipt into the mapping amount per kilogram', () => {
    const source = input();
    source.lines[0] = { ...source.lines[0], quantity: 500, unit: 'g' };
    source.mappings.get('milk')!.measure = 'weight';
    source.mappings.get('milk')!.packageBaseAmount = 1000;
    source.demand = [];
    expect(planReceipt(source).lines[0].bookAmount).toBe(500);
  });
  it('sends an incompatible receipt unit to review without booking', () => {
    const source = input();
    source.lines[0].unit = 'kg';
    expect(planReceipt(source).lines[0]).toMatchObject({ status: 'review', reviewReason: 'unit_mismatch', bookAmount: 0 });
  });
  it('does not credit a manual check exported after the receipt purchase', () => {
    const source = input();
    source.demand = [];
    source.lifecycles = [{ id: 'new-check', mealieItemId: 'new-row', checkedObservedAt: new Date('2026-10-03T12:00:00Z'),
      bookings: [{ effectId: 'new-booking', productId: 10, amount: 3, transactionId: 'tx' }], creditedByProduct: {},
      exports: [{ retailerProductId: 'milk', exportCreatedAt: new Date('2026-10-03T10:00:00Z') }] }];
    const result = planReceipt(source);
    expect(result.lines[0].credits).toEqual([]);
    expect(result.lines[0].bookAmount).toBe(3);
  });
  it('credits each actual booking once when a check contains repeated child products', () => {
    const source = input();
    source.lines[0].quantity = 5;
    source.demand = [];
    source.lifecycles = [{ id: 'check', mealieItemId: 'row', checkedObservedAt: new Date('2026-10-02T11:00:00Z'),
      bookings: [{ effectId: 'booking-a', productId: 10, amount: 2, transactionId: 'tx-a' }, { effectId: 'booking-b', productId: 10, amount: 3, transactionId: 'tx-b' }],
      creditedByProduct: {}, exports: [{ retailerProductId: 'milk', exportCreatedAt: new Date('2026-10-01T10:00:00Z') }] }];
    const result = planReceipt(source);
    expect(result.lines[0].credits.map(credit => [credit.bookingEffectId, credit.amount])).toEqual([['booking-a', 2], ['booking-b', 3]]);
    expect(result.lines[0].bookAmount).toBe(0);
  });
  it('derives weighed product mappings per kilogram independently of catalogue package units', () => {
    expect(derivePackageBaseAmount({ measure: 'weight', packageAmount: 500, packageUnit: 'g', baseUnitName: 'g' })?.amount).toBe(1000);
  });
});
