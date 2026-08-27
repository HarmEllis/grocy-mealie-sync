import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentStockResponse, Product } from '@/lib/grocy/types';
import type { MultiPurposeLabelSummary } from '@/lib/mealie/client/models/MultiPurposeLabelSummary';
import {
  drainPages,
  invalidateBrowseSnapshot,
  listDeviceLabels,
  listDeviceLetters,
  listDeviceProductsByLabel,
  listDeviceProductsByLetter,
  UNLABELED_ID,
  type DeviceBrowseDeps,
  type DeviceBrowseMealieFood,
  type DeviceBrowseProductMapping,
} from '../browse';

function product(id: number, name: string): Product {
  return { id, name };
}

function mapping(grocyProductId: number, mealieFoodId: string): DeviceBrowseProductMapping {
  return { grocyProductId, mealieFoodId };
}

function food(id: string, name: string, labelId: string | null): DeviceBrowseMealieFood {
  return { id, name, labelId };
}

function label(id: string, name: string): MultiPurposeLabelSummary {
  return { id, name, groupId: 'group-1' };
}

function stock(productId: number, amount: number): CurrentStockResponse {
  return { product_id: productId, amount } as CurrentStockResponse;
}

function createDeps(overrides: Partial<DeviceBrowseDeps> = {}): DeviceBrowseDeps {
  return {
    listGrocyProducts: vi.fn().mockResolvedValue([]),
    listProductMappings: vi.fn().mockResolvedValue([]),
    listMealieFoods: vi.fn().mockResolvedValue([]),
    listMealieLabels: vi.fn().mockResolvedValue([]),
    getCurrentStock: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

beforeEach(() => {
  // The snapshot cache is module-level; without this, a later test would
  // silently reuse an earlier test's deps/data.
  invalidateBrowseSnapshot();
});

describe('drainPages', () => {
  it('drains multiple full pages and stops on a short page', async () => {
    const page1 = Array.from({ length: 500 }, (_, i) => i);
    const page2 = Array.from({ length: 500 }, (_, i) => 500 + i);
    const page3 = [1000, 1001];
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: page1 })
      .mockResolvedValueOnce({ items: page2 })
      .mockResolvedValueOnce({ items: page3 });

    const result = await drainPages(fetchPage);

    expect(result).toHaveLength(1002);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1, 500);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 500);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 3, 500);
  });

  it('stops immediately on an empty first page', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [] });
    const result = await drainPages(fetchPage);
    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('treats a response with no items field as an empty page (absent metadata)', async () => {
    const fetchPage = vi.fn().mockResolvedValue({});
    const result = await drainPages(fetchPage);
    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe('bucket completeness invariant', () => {
  // 7 products: 2 -> label L1, 1 -> label L2, and 4 that must all fall back
  // to "unlabeled" for four different reasons (no mapping, stale mapping,
  // null labelId, and an unknown/deleted label id).
  const deps = createDeps({
    listGrocyProducts: vi.fn().mockResolvedValue([
      product(1, 'Appelsap'),
      product(2, 'Bananensap'),
      product(3, 'Cassis'),
      product(4, 'Druivensap'),
      product(5, 'Extra Product'),
      product(6, '5-Spice Mix'),
      product(7, 'Étoile Product'),
    ]),
    listProductMappings: vi.fn().mockResolvedValue([
      mapping(1, 'food-1'),
      mapping(2, 'food-2'),
      mapping(3, 'food-3'),
      mapping(4, 'food-4'), // food-4.labelId === null
      // product 5: no mapping row at all
      mapping(6, 'food-missing'), // stale mapping: food-missing does not exist
      mapping(7, 'food-7'), // food-7.labelId points at a label that isn't fetched
    ]),
    listMealieFoods: vi.fn().mockResolvedValue([
      food('food-1', 'Appelsap', 'L1'),
      food('food-2', 'Bananensap', 'L1'),
      food('food-3', 'Cassis', 'L2'),
      food('food-4', 'Druivensap', null),
      food('food-7', 'Étoile Product', 'L-unknown'),
    ]),
    listMealieLabels: vi.fn().mockResolvedValue([
      label('L1', 'Sap'),
      label('L2', 'Zuivel'),
    ]),
  });

  it('sums label counts (including unlabeled) to the total product count', async () => {
    const result = await listDeviceLabels(deps);
    const sum = result.labels.reduce((total, bucket) => total + bucket.count, 0);
    expect(sum).toBe(7);
  });

  it('resolves the expected bucket for each product and pins unlabeled last', async () => {
    const result = await listDeviceLabels(deps);
    expect(result.labels).toEqual([
      { id: 'L1', name: 'Sap', count: 2 },
      { id: 'L2', name: 'Zuivel', count: 1 },
      { id: UNLABELED_ID, name: 'Overig', count: 4 },
    ]);
  });

  it('sums letter counts to the total product count, including the # bucket', async () => {
    const result = await listDeviceLetters(deps);
    const sum = result.letters.reduce((total, bucket) => total + bucket.count, 0);
    expect(sum).toBe(7);

    const byLetter = Object.fromEntries(result.letters.map(b => [b.letter, b.count]));
    expect(byLetter.A).toBe(1);
    expect(byLetter.B).toBe(1);
    expect(byLetter.C).toBe(1);
    expect(byLetter.D).toBe(1);
    expect(byLetter.E).toBe(2); // "Extra Product" and diacritic-normalized "Étoile Product"
    expect(byLetter['#']).toBe(1); // "5-Spice Mix"
  });
});

describe('listDeviceLabels cap', () => {
  it('caps real labels at 19 by product count, always appends non-empty unlabeled last', async () => {
    // 25 labels with distinct, unambiguous counts (25 down to 1), plus 3
    // unmapped products landing in "unlabeled".
    const products: Product[] = [];
    const mappings: DeviceBrowseProductMapping[] = [];
    const foods: DeviceBrowseMealieFood[] = [];
    const labels: MultiPurposeLabelSummary[] = [];
    let productId = 1;

    for (let labelIndex = 1; labelIndex <= 25; labelIndex++) {
      const labelId = `L${labelIndex}`;
      const count = 26 - labelIndex; // L1 -> 25 products, L25 -> 1 product
      labels.push(label(labelId, `Label${String(labelIndex).padStart(2, '0')}`));
      for (let n = 0; n < count; n++) {
        const foodId = `food-${productId}`;
        products.push(product(productId, `Product ${productId}`));
        mappings.push(mapping(productId, foodId));
        foods.push(food(foodId, `Product ${productId}`, labelId));
        productId += 1;
      }
    }
    for (let n = 0; n < 3; n++) {
      products.push(product(productId, `Unmapped ${productId}`));
      productId += 1;
    }

    const deps = createDeps({
      listGrocyProducts: vi.fn().mockResolvedValue(products),
      listProductMappings: vi.fn().mockResolvedValue(mappings),
      listMealieFoods: vi.fn().mockResolvedValue(foods),
      listMealieLabels: vi.fn().mockResolvedValue(labels),
    });

    const result = await listDeviceLabels(deps);

    expect(result.labels).toHaveLength(20); // 19 real + unlabeled
    const last = result.labels[result.labels.length - 1];
    expect(last).toEqual({ id: UNLABELED_ID, name: 'Overig', count: 3 });

    const realIds = result.labels.filter(b => b.id !== UNLABELED_ID).map(b => b.id);
    // Top 19 by count desc are L1..L19 (counts 25..7); L20..L25 (counts 6..1) excluded.
    expect(realIds).toContain('L1');
    expect(realIds).toContain('L19');
    expect(realIds).not.toContain('L20');
    expect(realIds).not.toContain('L25');
  });

  it('keeps a worst-case 20-item label response safely under the firmware wire budget', async () => {
    // Genuinely unbounded-length label names (not an "assumed realistic"
    // size) — Mealie/Grocy names have no server-enforced max, so this proves
    // the hard ceiling is actually *enforced* (via truncateUtf8), not just
    // incidentally satisfied by a plausible fixture size.
    const longName = '🥐'.repeat(200) + 'x'.repeat(300); // ~1.1KB, multi-byte heavy
    const products: Product[] = [];
    const mappings: DeviceBrowseProductMapping[] = [];
    const foods: DeviceBrowseMealieFood[] = [];
    const labels: MultiPurposeLabelSummary[] = [];
    let productId = 1;

    for (let labelIndex = 1; labelIndex <= 19; labelIndex++) {
      const labelId = `L${labelIndex}-${'x'.repeat(32)}`; // long UUID-like id
      labels.push(label(labelId, `${longName}${labelIndex}`));
      const foodId = `food-${productId}`;
      products.push(product(productId, 'Product'));
      mappings.push(mapping(productId, foodId));
      foods.push(food(foodId, 'Product', labelId));
      productId += 1;
    }
    products.push(product(productId, 'Unmapped')); // ensures a non-empty unlabeled bucket

    const deps = createDeps({
      listGrocyProducts: vi.fn().mockResolvedValue(products),
      listProductMappings: vi.fn().mockResolvedValue(mappings),
      listMealieFoods: vi.fn().mockResolvedValue(foods),
      listMealieLabels: vi.fn().mockResolvedValue(labels),
    });

    const result = await listDeviceLabels(deps);
    const bytes = Buffer.byteLength(JSON.stringify(result), 'utf8');

    expect(result.labels.length).toBeLessThanOrEqual(20);
    expect(bytes).toBeLessThan(3584); // 3.5KB, safely under firmware MAX_RESPONSE (4096)
    for (const l of result.labels) {
      expect(Buffer.byteLength(l.name, 'utf8')).toBeLessThanOrEqual(63);
    }
  });

  it('truncates an oversized name to the UTF-8-safe byte cap without splitting a codepoint', async () => {
    const longName = '🥐'.repeat(40); // 160 bytes, way over the 63-byte cap
    const deps = createDeps({
      listGrocyProducts: vi.fn().mockResolvedValue([product(1, 'Product')]),
      listProductMappings: vi.fn().mockResolvedValue([mapping(1, 'food-1')]),
      listMealieFoods: vi.fn().mockResolvedValue([food('food-1', 'Product', 'L1')]),
      listMealieLabels: vi.fn().mockResolvedValue([label('L1', longName)]),
    });

    const result = await listDeviceLabels(deps);
    const truncated = result.labels[0].name;

    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(63);
    expect(truncated).not.toContain('�'); // no split multi-byte codepoint
  });

  it('truncates an oversized product name the same way', async () => {
    const longName = 'x'.repeat(500);
    const deps = createDeps({
      listGrocyProducts: vi.fn().mockResolvedValue([product(1, longName)]),
      listProductMappings: vi.fn().mockResolvedValue([mapping(1, 'food-1')]),
      listMealieFoods: vi.fn().mockResolvedValue([food('food-1', longName, 'L1')]),
      listMealieLabels: vi.fn().mockResolvedValue([label('L1', 'Fruit')]),
    });

    const result = await listDeviceProductsByLabel({ labelId: 'L1' }, deps);
    expect(Buffer.byteLength(result.results[0].name, 'utf8')).toBeLessThanOrEqual(63);
  });
});

describe('snapshot build deadline', () => {
  it('rejects with a timeout error when the snapshot build exceeds the deadline', async () => {
    vi.useFakeTimers();
    try {
      const deps = createDeps({
        listGrocyProducts: vi.fn(() => new Promise<Product[]>(() => {})), // never resolves
      });

      const promise = listDeviceLabels(deps);
      const expectation = expect(promise).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(6_000);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('listDeviceProductsByLabel / listDeviceProductsByLetter', () => {
  const deps = createDeps({
    listGrocyProducts: vi.fn().mockResolvedValue([
      product(1, 'Banaan'),
      product(2, 'Appel'),
      product(3, 'appelmoes'), // ties on normalized name prefix with id tiebreak below
    ]),
    listProductMappings: vi.fn().mockResolvedValue([
      mapping(1, 'food-1'),
      mapping(2, 'food-2'),
      mapping(3, 'food-3'),
    ]),
    listMealieFoods: vi.fn().mockResolvedValue([
      food('food-1', 'Banaan', 'L1'),
      food('food-2', 'Appel', 'L1'),
      food('food-3', 'appelmoes', 'L1'),
    ]),
    listMealieLabels: vi.fn().mockResolvedValue([label('L1', 'Fruit')]),
    getCurrentStock: vi.fn().mockResolvedValue([stock(1, 3), stock(2, 5)]),
  });

  it('sorts by normalized name ascending, then id, and includes stock', async () => {
    const result = await listDeviceProductsByLabel({ labelId: 'L1' }, deps);
    expect(result.results.map(r => r.name)).toEqual(['Appel', 'appelmoes', 'Banaan']);
    expect(result.results[0].stockAmount).toBe(5);
    expect(result.total).toBe(3);
    expect(result.hasMore).toBe(false);
  });

  it('paginates with offset/limit and reports hasMore', async () => {
    const result = await listDeviceProductsByLabel({ labelId: 'L1', offset: 0, limit: 2 }, deps);
    expect(result.results).toHaveLength(2);
    expect(result.total).toBe(3);
    expect(result.hasMore).toBe(true);
  });

  it('filters by A-Z letter using diacritic/case-insensitive normalization', async () => {
    const result = await listDeviceProductsByLetter({ letter: 'A' }, deps);
    expect(result.results.map(r => r.name).sort()).toEqual(['Appel', 'appelmoes']);
  });

  it('keeps a worst-case 20-item product-list response safely under the firmware wire budget', async () => {
    // 25 candidates (only the first page of 20 is returned) with genuinely
    // oversized, multi-byte-heavy names, large numeric ids, and large stock
    // values, proving the full end-to-end response payload — not just a
    // single name field — stays under the firmware's hard 4096-byte
    // MAX_RESPONSE ceiling.
    const longName = '🥐'.repeat(200) + 'x'.repeat(300);
    const bigProducts: Product[] = [];
    const bigMappings: DeviceBrowseProductMapping[] = [];
    const bigFoods: DeviceBrowseMealieFood[] = [];
    const bigStocks: CurrentStockResponse[] = [];

    for (let i = 1; i <= 25; i++) {
      const id = 1_000_000 + i;
      bigProducts.push(product(id, `${longName}${i}`));
      bigMappings.push(mapping(id, `food-${i}`));
      bigFoods.push(food(`food-${i}`, `${longName}${i}`, 'L1'));
      bigStocks.push(stock(id, 999_999.75));
    }

    const bigDeps = createDeps({
      listGrocyProducts: vi.fn().mockResolvedValue(bigProducts),
      listProductMappings: vi.fn().mockResolvedValue(bigMappings),
      listMealieFoods: vi.fn().mockResolvedValue(bigFoods),
      listMealieLabels: vi.fn().mockResolvedValue([label('L1', 'Fruit')]),
      getCurrentStock: vi.fn().mockResolvedValue(bigStocks),
    });

    const result = await listDeviceProductsByLabel({ labelId: 'L1' }, bigDeps);
    const bytes = Buffer.byteLength(JSON.stringify(result), 'utf8');

    expect(result.results.length).toBeLessThanOrEqual(20);
    expect(bytes).toBeLessThan(4096);
    for (const r of result.results) {
      expect(Buffer.byteLength(r.name, 'utf8')).toBeLessThanOrEqual(63);
    }
  });
});
