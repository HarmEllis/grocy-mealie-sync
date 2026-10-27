import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/use-cases/devices/scanner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/use-cases/devices/scanner')>();
  return {
    ...actual,
    searchDeviceProducts: vi.fn(),
    createDeviceProduct: vi.fn(),
    createDeviceProductFromMealieFood: vi.fn(),
  };
});
vi.mock('@/lib/use-cases/devices/browse', () => ({
  listDeviceProductsByLabel: vi.fn(),
  listDeviceProductsByLetter: vi.fn(),
}));

import { listDeviceProductsByLabel, listDeviceProductsByLetter } from '@/lib/use-cases/devices/browse';
import {
  createDeviceProduct,
  createDeviceProductFromMealieFood,
  searchDeviceProducts,
} from '@/lib/use-cases/devices/scanner';
import { GET, POST } from '../route';

function request(query: string): Request {
  return new Request(`http://device.local/api/device/v1/products${query}`);
}

describe('GET /api/device/v1/products — selector validation', () => {
  it('rejects when no selector is present', async () => {
    const res = await GET(request(''));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/exactly one/i);
  });

  it('rejects when two selectors are present', async () => {
    const res = await GET(request('?query=milk&labelId=L1'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/exactly one/i);
  });

  it('rejects an unknown query parameter', async () => {
    const res = await GET(request('?query=milk&bogus=1'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/unknown query parameter/i);
  });

  it('rejects a duplicate parameter key', async () => {
    const res = await GET(request('?query=milk&query=eggs'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/duplicate query parameter/i);
  });
});

describe('GET /api/device/v1/products?query= — unchanged existing behavior', () => {
  it('still rejects an empty query', async () => {
    const res = await GET(request('?query=%20%20'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Query must not be empty');
  });

  it('delegates to searchDeviceProducts', async () => {
    vi.mocked(searchDeviceProducts).mockResolvedValue({ results: [{ id: 1, name: 'Milk', stockAmount: 2 }] });
    const res = await GET(request('?query=milk'));
    expect(res.status).toBe(200);
    expect(searchDeviceProducts).toHaveBeenCalledWith({ query: 'milk', limit: undefined });
  });

  it('rejects offset, which is not part of the query contract', async () => {
    const res = await GET(request('?query=milk&offset=0'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/offset is not supported/i);
  });
});

describe('GET /api/device/v1/products?labelId=', () => {
  it('rejects a non-integer offset', async () => {
    const res = await GET(request('?labelId=L1&offset=abc'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/offset/i);
  });

  it.each(['1e300', '9007199254740992'])('rejects an unsafe integer offset (%s)', async (offset) => {
    const res = await GET(request(`?labelId=L1&offset=${offset}`));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/offset/i);
  });

  it('rejects a limit above the browse max', async () => {
    const res = await GET(request('?labelId=L1&limit=21'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/limit/i);
  });

  it('rejects an empty labelId', async () => {
    const res = await GET(request('?labelId=%20'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/labelid/i);
  });

  it('delegates to listDeviceProductsByLabel with defaults', async () => {
    vi.mocked(listDeviceProductsByLabel).mockResolvedValue({
      results: [], total: 0, offset: 0, hasMore: false,
    });
    const res = await GET(request('?labelId=L1'));
    expect(res.status).toBe(200);
    expect(listDeviceProductsByLabel).toHaveBeenCalledWith({ labelId: 'L1', offset: 0, limit: 20 });
  });

  it('translates a use-case error into the device error response shape', async () => {
    vi.mocked(listDeviceProductsByLabel).mockRejectedValue(new Error('boom'));
    const res = await GET(request('?labelId=L1'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('boom');
  });
});

describe('GET /api/device/v1/products?letter=', () => {
  it('rejects an invalid letter', async () => {
    const res = await GET(request('?letter=AB'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/letter/i);
  });

  it('accepts the # bucket', async () => {
    vi.mocked(listDeviceProductsByLetter).mockResolvedValue({
      results: [], total: 0, offset: 0, hasMore: false,
    });
    const res = await GET(request(`?letter=${encodeURIComponent('#')}`));
    expect(res.status).toBe(200);
    expect(listDeviceProductsByLetter).toHaveBeenCalledWith({ letter: '#', offset: 0, limit: 20 });
  });

  it('uppercases a lowercase letter', async () => {
    vi.mocked(listDeviceProductsByLetter).mockResolvedValue({
      results: [], total: 0, offset: 0, hasMore: false,
    });
    await GET(request('?letter=b'));
    expect(listDeviceProductsByLetter).toHaveBeenCalledWith({ letter: 'B', offset: 0, limit: 20 });
  });
});

describe('GET /api/device/v1/products?query=&include=mealie', () => {
  it('passes the opt-in to searchDeviceProducts', async () => {
    vi.mocked(searchDeviceProducts).mockResolvedValue({ results: [] });
    const res = await GET(request('?query=milk&include=mealie'));
    expect(res.status).toBe(200);
    expect(searchDeviceProducts).toHaveBeenLastCalledWith(expect.objectContaining({ includeMealie: true }));
  });

  it('rejects an unsupported include value', async () => {
    expect((await GET(request('?query=milk&include=other'))).status).toBe(400);
  });

  it('rejects include without query', async () => {
    expect((await GET(request('?letter=A&include=mealie'))).status).toBe(400);
  });
});

describe('POST /api/device/v1/products with mealieFoodId', () => {
  function post(body: unknown): Request {
    return new Request('http://device.local/api/device/v1/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('creates the product from the Mealie food', async () => {
    vi.mocked(createDeviceProductFromMealieFood).mockResolvedValue({ id: 77, name: 'Oat Milk' } as never);
    const res = await POST(post({ mealieFoodId: 'food-5', barcode: '4006381333931' }));
    expect(res.status).toBe(201);
    expect(createDeviceProductFromMealieFood).toHaveBeenCalledWith({ mealieFoodId: 'food-5', barcode: '4006381333931' });
  });

  it.each([[''], ['   '], [5], [null]])('rejects mealieFoodId %j without creating anything', async value => {
    vi.mocked(createDeviceProduct).mockClear();
    const res = await POST(post({ name: 'Oat Milk', mealieFoodId: value, barcode: '4006381333931' }));
    expect(res.status).toBe(400);
    expect(createDeviceProduct).not.toHaveBeenCalled();
  });

  it.each([[true], [1], ['milk'], [[]]])('answers a non-object body %j with 400', async body => {
    expect((await POST(post(body))).status).toBe(400);
  });

  it('rejects an invalid barcode', async () => {
    expect((await POST(post({ mealieFoodId: 'food-5', barcode: 'x' }))).status).toBe(400);
  });
});
