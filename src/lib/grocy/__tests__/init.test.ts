import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  config: {
    grocyUrl: 'https://grocy.test',
    grocyApiKey: 'grocy-key',
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

describe('grocy client bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    mockState.OpenAPI.BASE = '';
    mockState.OpenAPI.HEADERS = undefined;
    mockState.OpenAPI.ALLOW_INSECURE_TLS = false;
    mockState.config.grocyUrl = 'https://grocy.test';
    mockState.config.grocyApiKey = 'grocy-key';
    mockState.config.allowInsecureTls = false;
  });

  it('configures the generated client including the insecure TLS flag', async () => {
    mockState.config.allowInsecureTls = true;

    await import('../init');

    expect(mockState.OpenAPI.BASE).toBe('https://grocy.test/api');
    expect(mockState.OpenAPI.HEADERS).toEqual({
      'GROCY-API-KEY': 'grocy-key',
    });
    expect(mockState.OpenAPI.ALLOW_INSECURE_TLS).toBe(true);
  });
});
