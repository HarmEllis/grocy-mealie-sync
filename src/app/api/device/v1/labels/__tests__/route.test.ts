import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/use-cases/devices/browse', () => ({
  listDeviceLabels: vi.fn(),
}));

import { listDeviceLabels } from '@/lib/use-cases/devices/browse';
import { GET } from '../route';

describe('GET /api/device/v1/labels', () => {
  it('returns the labels payload', async () => {
    vi.mocked(listDeviceLabels).mockResolvedValue({
      labels: [{ id: 'L1', name: 'Broodbeleg', count: 3 }],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ labels: [{ id: 'L1', name: 'Broodbeleg', count: 3 }] });
  });

  it('translates a use-case failure into the device error response shape', async () => {
    vi.mocked(listDeviceLabels).mockRejectedValue(new Error('mealie unreachable'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('mealie unreachable');
  });
});
