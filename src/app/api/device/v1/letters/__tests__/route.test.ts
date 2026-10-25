import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/use-cases/devices/browse', () => ({
  listDeviceLetters: vi.fn(),
}));

import { listDeviceLetters } from '@/lib/use-cases/devices/browse';
import { GET } from '../route';

describe('GET /api/device/v1/letters', () => {
  it('returns the letters payload', async () => {
    vi.mocked(listDeviceLetters).mockResolvedValue({
      letters: [{ letter: 'A', count: 2 }, { letter: '#', count: 1 }],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      letters: [{ letter: 'A', count: 2 }, { letter: '#', count: 1 }],
    });
  });

  it('translates a use-case failure into the device error response shape', async () => {
    vi.mocked(listDeviceLetters).mockRejectedValue(new Error('grocy unreachable'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('grocy unreachable');
  });
});
