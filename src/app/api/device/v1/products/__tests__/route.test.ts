import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/use-cases/devices/scanner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/use-cases/devices/scanner')>();
  return {
    ...actual,
    searchDeviceProducts: vi.fn(),
    createDeviceProduct: vi.fn(),
  };
});
vi.mock('@/lib/use-cases/devices/browse', () => ({
  listDeviceProductsByLabel: vi.fn(),
  listDeviceProductsByLetter: vi.fn(),
}));

import { listDeviceProductsByLabel, listDeviceProductsByLetter } from '@/lib/use-cases/devices/browse';
import { searchDeviceProducts } from '@/lib/use-cases/devices/scanner';
import { GET } from '../route';

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
