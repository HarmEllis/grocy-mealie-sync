import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  config: {
    mealieUrl: 'https://mealie.test',
    mealieApiToken: 'token-123',
    allowInsecureTls: false,
  },
  OpenAPI: {
    BASE: '',
    HEADERS: undefined as Record<string, string> | undefined,
    ALLOW_INSECURE_TLS: false,
  },
}));

vi.mock('../../config', () => ({
  config: mockState.config,
}));

vi.mock('../client', () => ({
  OpenAPI: mockState.OpenAPI,
}));

describe('mealie client bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    mockState.OpenAPI.BASE = '';
    mockState.OpenAPI.HEADERS = undefined;
    mockState.OpenAPI.ALLOW_INSECURE_TLS = false;
    mockState.config.mealieUrl = 'https://mealie.test';
    mockState.config.mealieApiToken = 'token-123';
    mockState.config.allowInsecureTls = false;
  });

  it('configures the generated client including the insecure TLS flag', async () => {
    mockState.config.allowInsecureTls = true;

    await import('../index');

    expect(mockState.OpenAPI.BASE).toBe('https://mealie.test');
    expect(mockState.OpenAPI.HEADERS).toEqual({
      Authorization: 'Bearer token-123',
    });
    expect(mockState.OpenAPI.ALLOW_INSECURE_TLS).toBe(true);
  });
});
