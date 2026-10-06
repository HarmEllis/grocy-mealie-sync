import { describe, expect, it, vi } from 'vitest';
import { ConversionLibraryError } from '@/lib/use-cases/conversions/library';
import { importConversionLibrary } from '@/lib/use-cases/conversions/library';
import { POST } from './import/route';

vi.mock('@/lib/use-cases/conversions/library', async original => ({ ...await original<typeof import('@/lib/use-cases/conversions/library')>(), importConversionLibrary: vi.fn() }));
describe('conversion import API', () => {
  it('returns a machine-readable stale preview conflict', async () => {
    vi.mocked(importConversionLibrary).mockRejectedValueOnce(new ConversionLibraryError('PREVIEW_STALE', 'Review the latest setup.'));
    const response = await POST(new Request('http://localhost/api/conversions/import', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'PREVIEW_STALE', error: 'Review the latest setup.' });
  });
  it('reports malformed JSON without invoking import', async () => {
    vi.mocked(importConversionLibrary).mockClear();
    const response = await POST(new Request('http://localhost/api/conversions/import', { method: 'POST', body: 'invalid' }));
    expect(response.status).toBe(400); expect(importConversionLibrary).not.toHaveBeenCalled();
  });
});
