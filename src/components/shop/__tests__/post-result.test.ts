import { beforeEach, describe, expect, it, vi } from 'vitest';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
const api = vi.hoisted(() => ({ apiJson: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('../api', () => api);
import { post } from '../shop-common';

beforeEach(() => { toasts.success.mockClear(); toasts.error.mockClear(); toasts.warning.mockClear(); api.apiJson.mockReset(); });

describe('post', () => {
  it('reports success for an ordinary answer', async () => {
    api.apiJson.mockResolvedValue({ ok: true });
    expect(await post('/x', {}, 'Done')).toBe(true);
    expect(toasts.success).toHaveBeenCalledWith('Done');
  });

  it('does not call a refused correction a success, even when the server answered 200', async () => {
    api.apiJson.mockResolvedValue({ status: 'failed', message: 'Grocy rejected the correction. Nothing was changed.' });
    expect(await post('/x', {}, 'Booking undone')).toBe(false);
    expect(toasts.error).toHaveBeenCalledWith('Action failed', { description: 'Grocy rejected the correction. Nothing was changed.' });
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('shows an unknown outcome as a warning and still lets the page reload', async () => {
    api.apiJson.mockResolvedValue({ status: 'unknown', message: 'The correction has an unknown outcome; check Grocy and resolve the effect.' });
    expect(await post('/x', {}, 'Difference consumed')).toBe(true);
    expect(toasts.warning).toHaveBeenCalledWith('Outcome uncertain', { description: expect.stringContaining('unknown outcome') });
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('shows a thrown error', async () => {
    api.apiJson.mockRejectedValue(new Error('boom'));
    expect(await post('/x', {}, 'Done')).toBe(false);
    expect(toasts.error).toHaveBeenCalledWith('Action failed', { description: 'boom' });
  });
});
