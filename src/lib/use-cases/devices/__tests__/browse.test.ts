import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentStockResponse, Product } from '@/lib/grocy/types';
import { CancelablePromise, CancelError } from '@/lib/mealie';
import type { MultiPurposeLabelSummary } from '@/lib/mealie/client/models/MultiPurposeLabelSummary';
import { DeviceUpstreamTimeoutError } from '../scanner';
import {
  cancelOnAbort,
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
  toDeviceName,
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

  it('requests no page once the signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('abandoned'));
    const fetchPage = vi.fn().mockResolvedValue({ items: [] });

    await expect(drainPages(fetchPage, controller.signal)).rejects.toThrow('abandoned');
    expect(fetchPage).not.toHaveBeenCalled();
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('shared snapshot build', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    invalidateBrowseSnapshot();
    vi.useRealTimers();
  });

  it('lets concurrent callers share one build', async () => {
    const products = deferred<Product[]>();
    const deps = createDeps({ listGrocyProducts: vi.fn(() => products.promise) });

    const first = listDeviceLabels(deps);
    const second = listDeviceLetters(deps);
    products.resolve([product(1, 'Appel')]);

    expect((await first).labels).toEqual([{ id: UNLABELED_ID, name: 'Overig', count: 1 }]);
    expect((await second).letters.find(b => b.letter === 'A')?.count).toBe(1);
    expect(deps.listGrocyProducts).toHaveBeenCalledTimes(1);
    expect(deps.listMealieFoods).toHaveBeenCalledTimes(1);
  });

  it('serves the cached snapshot within the TTL and rebuilds after it', async () => {
    const deps = createDeps({ listGrocyProducts: vi.fn().mockResolvedValue([product(1, 'Appel')]) });

    await listDeviceLabels(deps);
    await vi.advanceTimersByTimeAsync(29_000);
    await listDeviceLabels(deps);
    expect(deps.listGrocyProducts).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    await listDeviceLabels(deps);
    expect(deps.listGrocyProducts).toHaveBeenCalledTimes(2);
  });

  it('rebuilds on the next call after an upstream failure', async () => {
    const deps = createDeps({
      listGrocyProducts: vi.fn()
        .mockRejectedValueOnce(new Error('Grocy down'))
        .mockResolvedValueOnce([product(1, 'Appel')]),
    });

    await expect(listDeviceLabels(deps)).rejects.toThrow('Grocy down');
    expect((await listDeviceLabels(deps)).labels).toHaveLength(1);
    expect(deps.listGrocyProducts).toHaveBeenCalledTimes(2);
  });

  it('keeps a build that outlives one caller deadline and lets the retry reuse it', async () => {
    const products = deferred<Product[]>();
    const deps = createDeps({ listGrocyProducts: vi.fn(() => products.promise) });

    const first = listDeviceLabels(deps);
    const firstExpectation = expect(first).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(6_000);
    await firstExpectation;

    // The retry joins the still-running build instead of starting another.
    const retry = listDeviceLabels(deps);
    products.resolve([product(1, 'Appel')]);
    expect((await retry).labels).toHaveLength(1);
    expect(deps.listGrocyProducts).toHaveBeenCalledTimes(1);

    // And its result was cached.
    await listDeviceLetters(deps);
    expect(deps.listGrocyProducts).toHaveBeenCalledTimes(1);
  });

  it('caches a build that finishes after every caller gave up', async () => {
    const products = deferred<Product[]>();
    const deps = createDeps({ listGrocyProducts: vi.fn(() => products.promise) });

    const first = listDeviceLabels(deps);
    const firstExpectation = expect(first).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(6_000);
    await firstExpectation;

    products.resolve([product(1, 'Appel')]);
    await vi.advanceTimersByTimeAsync(0);

    expect((await listDeviceLabels(deps)).labels).toHaveLength(1);
    expect(deps.listGrocyProducts).toHaveBeenCalledTimes(1);
  });

  it('abandons a build after 60s: no further page is fetched and the next call starts fresh', async () => {
    const firstPage = deferred<{ items: DeviceBrowseMealieFood[] }>();
    const fetchPage = vi.fn()
      .mockImplementationOnce(() => firstPage.promise)
      .mockResolvedValue({ items: [] });
    const deps = createDeps({
      listMealieFoods: vi.fn((signal: AbortSignal) => drainPages<DeviceBrowseMealieFood>(fetchPage, signal)),
    });

    for (let elapsed = 0; elapsed < 60_000; elapsed += 6_000) {
      const call = listDeviceLabels(deps);
      const expectation = expect(call).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(6_000);
      await expectation;
    }
    // Ten callers gave up across the 60s; they all shared one build.
    expect(deps.listGrocyProducts).toHaveBeenCalledTimes(1);

    // The first page finally arrives as a full page after the abandonment.
    firstPage.resolve({ items: Array.from({ length: 500 }, (_, i) => food(`f${i}`, 'x', null)) });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);

    // The slot was released, so the next call builds again.
    await listDeviceLabels(deps);
    expect(deps.listGrocyProducts).toHaveBeenCalledTimes(2);
  });
});

describe('cancelOnAbort', () => {
  it('cancels the request on abort and rejects with the abort reason', async () => {
    const onCancelHandler = vi.fn();
    const request = new CancelablePromise<string>((_resolve, _reject, onCancel) => {
      onCancel(onCancelHandler);
    });
    const controller = new AbortController();
    const reason = new DeviceUpstreamTimeoutError('Browse snapshot build', 60_000);

    const pending = cancelOnAbort(request, controller.signal);
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(onCancelHandler).toHaveBeenCalledTimes(1);
    expect(request.isCancelled).toBe(true);
  });

  it('passes through the error of a request that fails without an abort', async () => {
    const error = new CancelError('Request aborted');
    const request = new CancelablePromise<string>((_resolve, reject) => reject(error));
    await expect(cancelOnAbort(request, new AbortController().signal)).rejects.toBe(error);
  });
});

describe('snapshot abandonment with a cancelled generated request', () => {
  afterEach(() => {
    invalidateBrowseSnapshot();
    vi.useRealTimers();
  });

  it('rejects a caller joining near the 60s mark with the timeout error, not CancelError', async () => {
    vi.useFakeTimers();
    const deps = createDeps({
      // A Mealie request that never answers on its own, like a hung upstream.
      listMealieFoods: vi.fn((signal: AbortSignal) => cancelOnAbort(new CancelablePromise<DeviceBrowseMealieFood[]>(() => {}), signal)),
    });

    const first = listDeviceLabels(deps);
    const firstExpectation = expect(first).rejects.toBeInstanceOf(DeviceUpstreamTimeoutError);
    await vi.advanceTimersByTimeAsync(55_000);
    await firstExpectation;

    // Joins the same build 5s before it is abandoned, inside its own 6s wait.
    const late = listDeviceLabels(deps);
    const lateExpectation = expect(late).rejects.toBeInstanceOf(DeviceUpstreamTimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await lateExpectation;
    expect(deps.listGrocyProducts).toHaveBeenCalledTimes(1);
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
});

// ---------------------------------------------------------------------------
// Firmware wire budget (docs/DEVICE-API.md, "Firmware-driven design
// constraints"): the serialized body, measured as encoded UTF-8 JSON bytes
// including escaping, must stay under MAX_RESPONSE (4096). Names must fit
// API_NAME_LEN (63 decoded bytes), label ids API_LABEL_ID_LEN (39 chars).
// ---------------------------------------------------------------------------

const MAX_RESPONSE = 4096;
const CONTROLS = '\u0001\u0002\u0007\u0008\u000B\u000C\u001B\u001F\u007F\u0085\u009F\t\n\r';
// eslint-disable-next-line no-control-regex
const CONTROL_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;

const HOSTILE_NAMES = {
  // Controls interleaved with letters; each control would be up to 6 bytes
  // escaped (\u0001) if it reached the wire.
  controlOnly: Array.from({ length: 100 }, (_, i) => `${CONTROLS[i % CONTROLS.length]}x`).join(''),
  // Every character escapes to 2 bytes, so the encoded cap must be the one
  // that bites.
  quoteBackslash: '"\\'.repeat(100),
  // 4-byte emoji and 3-byte CJK: the decoded 63-byte cap must bite without
  // splitting a code point.
  multibyte: '🥐漢'.repeat(100),
} as const;

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function encodedNameBytes(name: string): number {
  return Buffer.byteLength(JSON.stringify(name), 'utf8') - 2;
}

function expectDeviceSafeName(name: string): void {
  expect(Buffer.byteLength(name, 'utf8')).toBeLessThanOrEqual(63);
  expect(encodedNameBytes(name)).toBeLessThanOrEqual(96);
  expect(name).not.toMatch(CONTROL_PATTERN);
  expect(name).not.toContain('\uFFFD');
  expect(name.length).toBeGreaterThan(0);
}

describe('toDeviceName', () => {
  it('replaces control characters with single spaces and trims', () => {
    expect(toDeviceName('\u0001Melk\u0000\u0000\t halfvol\u009F\n')).toBe('Melk halfvol');
  });

  it('returns an empty string when only control characters are left', () => {
    expect(toDeviceName('\u0001\u0002\n\t')).toBe('');
    expect(toDeviceName(undefined)).toBe('');
  });

  it('applies the encoded cap to escape-heavy names', () => {
    const name = toDeviceName(HOSTILE_NAMES.quoteBackslash);
    expect(name).toBe('"\\'.repeat(24));
    expect(name).toHaveLength(48);
    expect(encodedNameBytes(name)).toBe(96);
    expect(Buffer.byteLength(name, 'utf8')).toBe(48); // under the 63-byte decoded cap
  });

  it('applies the decoded cap to multi-byte names without splitting a code point', () => {
    const name = toDeviceName(HOSTILE_NAMES.multibyte);
    // 🥐 (4) + 漢 (3) = 7 bytes per pair; 9 pairs = 63 bytes exactly.
    expect(name).toBe('🥐漢'.repeat(9));
    expect(Buffer.byteLength(name, 'utf8')).toBe(63);
  });

  it('turns a lone surrogate into U+FFFD instead of an escaped surrogate', () => {
    const name = toDeviceName('Kaas \uD83E');
    expect(name).toBe('Kaas \uFFFD');
    expect(JSON.stringify(name)).not.toContain('\\u');
  });

  it('keeps ordinary names unchanged', () => {
    expect(toDeviceName('Étoile Product')).toBe('Étoile Product');
  });
});

describe.each(Object.entries(HOSTILE_NAMES))('wire budget with %s names', (_fixture, hostile) => {
  it('keeps a full 19+1 label list under MAX_RESPONSE', async () => {
    const products: Product[] = [];
    const mappings: DeviceBrowseProductMapping[] = [];
    const foods: DeviceBrowseMealieFood[] = [];
    const labels: MultiPurposeLabelSummary[] = [];
    let productId = Number.MAX_SAFE_INTEGER - 1000;

    // 25 labels with 39-char ids, so the 19-label cap applies; counts 25..1.
    for (let labelIndex = 1; labelIndex <= 25; labelIndex++) {
      const labelId = `${String(labelIndex).padStart(3, '0')}-${'f'.repeat(35)}`;
      expect(labelId).toHaveLength(39);
      labels.push(label(labelId, `${labelIndex}${hostile}`));
      for (let n = 0; n < 26 - labelIndex; n++) {
        const foodId = `food-${productId}`;
        products.push(product(productId, `${hostile}${productId}`));
        mappings.push(mapping(productId, foodId));
        foods.push(food(foodId, 'food', labelId));
        productId += 1;
      }
    }
    products.push(product(productId, hostile)); // unmapped -> unlabeled

    const deps = createDeps({
      listGrocyProducts: vi.fn().mockResolvedValue(products),
      listProductMappings: vi.fn().mockResolvedValue(mappings),
      listMealieFoods: vi.fn().mockResolvedValue(foods),
      listMealieLabels: vi.fn().mockResolvedValue(labels),
    });

    const result = await listDeviceLabels(deps);

    expect(result.labels).toHaveLength(20);
    expect(result.labels[19]).toEqual({ id: UNLABELED_ID, name: 'Overig', count: 1 });
    expect(serializedBytes(result)).toBeLessThan(MAX_RESPONSE);
    for (const bucket of result.labels) {
      expectDeviceSafeName(bucket.name);
      expect(bucket.id.length).toBeLessThanOrEqual(39);
    }
  });

  function bigCatalogueDeps(namePrefix: string): DeviceBrowseDeps {
    const products: Product[] = [];
    const mappings: DeviceBrowseProductMapping[] = [];
    const foods: DeviceBrowseMealieFood[] = [];
    const stocks: CurrentStockResponse[] = [];
    // 25 matching products at the top of the safe-integer range, with
    // stock amounts that serialize to the longest finite number forms.
    for (let i = 0; i < 25; i++) {
      const id = Number.MAX_SAFE_INTEGER - i;
      products.push(product(id, `${namePrefix}${hostile}${i}`));
      mappings.push(mapping(id, `food-${i}`));
      foods.push(food(`food-${i}`, 'food', 'L1'));
      stocks.push(stock(id, -Number.MAX_VALUE / (i + 1)));
    }
    return createDeps({
      listGrocyProducts: vi.fn().mockResolvedValue(products),
      listProductMappings: vi.fn().mockResolvedValue(mappings),
      listMealieFoods: vi.fn().mockResolvedValue(foods),
      listMealieLabels: vi.fn().mockResolvedValue([label('L1', 'Fruit')]),
      getCurrentStock: vi.fn().mockResolvedValue(stocks),
    });
  }

  function expectFullPage(result: Awaited<ReturnType<typeof listDeviceProductsByLabel>>): void {
    expect(result.results).toHaveLength(20);
    expect(result.total).toBe(25);
    expect(result.hasMore).toBe(true);
    expect(serializedBytes(result)).toBeLessThan(MAX_RESPONSE);
    for (const row of result.results) {
      expectDeviceSafeName(row.name);
      expect(Number.isSafeInteger(row.id)).toBe(true);
    }
  }

  it('keeps a full label product page under MAX_RESPONSE', async () => {
    expectFullPage(await listDeviceProductsByLabel({ labelId: 'L1' }, bigCatalogueDeps('')));
  });

  it('keeps a full letter product page under MAX_RESPONSE', async () => {
    expectFullPage(await listDeviceProductsByLetter({ letter: 'A' }, bigCatalogueDeps('A')));
  });

  it('keeps a full # product page under MAX_RESPONSE', async () => {
    expectFullPage(await listDeviceProductsByLetter({ letter: '#' }, bigCatalogueDeps('7')));
  });
});

describe('letters wire budget', () => {
  it('keeps all 27 buckets under MAX_RESPONSE', async () => {
    const products = Array.from({ length: 30 }, (_, i) => product(Number.MAX_SAFE_INTEGER - i, `${'ABC'[i % 3]}x`));
    const result = await listDeviceLetters(createDeps({ listGrocyProducts: vi.fn().mockResolvedValue(products) }));
    expect(result.letters).toHaveLength(27);
    expect(serializedBytes(result)).toBeLessThan(MAX_RESPONSE);
  });
});

describe('device-addressable labels', () => {
  it('drops labels whose id the firmware cannot hold or echo and counts their products as unlabeled', async () => {
    const deps = createDeps({
      listGrocyProducts: vi.fn().mockResolvedValue([
        product(1, 'Appel'),
        product(2, 'Banaan'),
        product(3, 'Cassis'),
        product(4, 'Dadel'),
      ]),
      listProductMappings: vi.fn().mockResolvedValue([
        mapping(1, 'food-1'),
        mapping(2, 'food-2'),
        mapping(3, 'food-3'),
        mapping(4, 'food-4'),
      ]),
      listMealieFoods: vi.fn().mockResolvedValue([
        food('food-1', 'Appel', 'ok-label'),
        food('food-2', 'Banaan', 'x'.repeat(40)), // too long for API_LABEL_ID_LEN
        food('food-3', 'Cassis', 'needs space'), // needs URL encoding
        food('food-4', 'Dadel', 'no-name'), // name is only control characters
      ]),
      listMealieLabels: vi.fn().mockResolvedValue([
        label('ok-label', 'Fruit'),
        label('x'.repeat(40), 'Lang'),
        label('needs space', 'Spatie'),
        label('no-name', '\u0001\u0002'),
      ]),
    });

    const result = await listDeviceLabels(deps);
    expect(result.labels).toEqual([
      { id: 'ok-label', name: 'Fruit', count: 1 },
      { id: UNLABELED_ID, name: 'Overig', count: 3 },
    ]);

    const unlabeled = await listDeviceProductsByLabel({ labelId: UNLABELED_ID }, deps);
    expect(unlabeled.results.map(r => r.id)).toEqual([2, 3, 4]);
  });

  it('never lets a real label claim the reserved unlabeled id', async () => {
    const deps = createDeps({
      listGrocyProducts: vi.fn().mockResolvedValue([
        product(1, 'Appel'),
        product(2, 'Banaan'),
        product(3, 'Cassis'),
      ]),
      listProductMappings: vi.fn().mockResolvedValue([
        mapping(1, 'food-1'),
        mapping(2, 'food-2'),
        // product 3: unmapped
      ]),
      listMealieFoods: vi.fn().mockResolvedValue([
        food('food-1', 'Appel', UNLABELED_ID),
        food('food-2', 'Banaan', 'L1'),
      ]),
      listMealieLabels: vi.fn().mockResolvedValue([
        label(UNLABELED_ID, 'Echte label'),
        label('L1', 'Fruit'),
      ]),
    });

    const result = await listDeviceLabels(deps);
    expect(result.labels).toEqual([
      { id: 'L1', name: 'Fruit', count: 1 },
      { id: UNLABELED_ID, name: 'Overig', count: 2 },
    ]);
    expect(result.labels.filter(b => b.id === UNLABELED_ID)).toHaveLength(1);

    const unlabeled = await listDeviceProductsByLabel({ labelId: UNLABELED_ID }, deps);
    expect(unlabeled.results.map(r => r.id)).toEqual([1, 3]);
  });
});

describe('product ids, names and stock the device can use', () => {
  const deps = createDeps({
    listGrocyProducts: vi.fn().mockResolvedValue([
      product(1, 'Appel'),
      product(0, 'Zero id'),
      { id: -5, name: 'Negative id' } as Product,
      { id: 1.5, name: 'Fraction id' } as Product,
      { id: Number.MAX_SAFE_INTEGER + 2, name: 'Unsafe id' } as Product,
      product(2, '\u0001Bloem'),
      product(3, '\u0002\u0003'),
    ]),
    getCurrentStock: vi.fn().mockResolvedValue([
      stock(1, Number.NaN),
      stock(2, Number.POSITIVE_INFINITY),
      stock(3, 2.5),
    ]),
  });

  it('leaves out products without a positive safe-integer id everywhere', async () => {
    const labels = await listDeviceLabels(deps);
    expect(labels.labels).toEqual([{ id: UNLABELED_ID, name: 'Overig', count: 3 }]);

    const letters = await listDeviceLetters(deps);
    expect(letters.letters.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3);

    const unlabeled = await listDeviceProductsByLabel({ labelId: UNLABELED_ID }, deps);
    expect(unlabeled.results.map(r => r.id).sort()).toEqual([1, 2, 3]);
  });

  it('buckets on the first visible character and falls back for an empty name', async () => {
    const byB = await listDeviceProductsByLetter({ letter: 'B' }, deps);
    expect(byB.results).toEqual([{ id: 2, name: 'Bloem', stockAmount: 0 }]);

    const byU = await listDeviceProductsByLetter({ letter: 'U' }, deps);
    expect(byU.results).toEqual([{ id: 3, name: 'Unknown', stockAmount: 2.5 }]);
  });

  it('reports non-finite stock as 0', async () => {
    const byA = await listDeviceProductsByLetter({ letter: 'A' }, deps);
    expect(byA.results).toEqual([{ id: 1, name: 'Appel', stockAmount: 0 }]);
  });
});
