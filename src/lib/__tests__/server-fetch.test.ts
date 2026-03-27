import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  agent: { __brand: 'insecure-agent' },
  Agent: vi.fn(class MockAgent {
    constructor() {
      return mockState.agent;
    }
  }),
}));

vi.mock('undici', () => ({
  Agent: mockState.Agent,
}));

import { buildServerFetchInit } from '../server-fetch';

describe('buildServerFetchInit', () => {
  beforeEach(() => {
    mockState.Agent.mockClear();
  });

  it('returns the original init when insecure TLS is disabled', () => {
    const init = buildServerFetchInit(
      {
        method: 'POST',
      },
      false,
    );

    expect(init).toEqual({ method: 'POST' });
    expect(mockState.Agent).not.toHaveBeenCalled();
  });

  it('adds a shared insecure dispatcher when enabled', () => {
    const first = buildServerFetchInit({ method: 'GET' }, true);
    const second = buildServerFetchInit({ method: 'POST' }, true);

    expect(first).toEqual(expect.objectContaining({
      method: 'GET',
      dispatcher: mockState.agent,
    }));
    expect(second).toEqual(expect.objectContaining({
      method: 'POST',
      dispatcher: mockState.agent,
    }));
    expect(mockState.Agent).toHaveBeenCalledTimes(1);
    expect(mockState.Agent).toHaveBeenCalledWith({
      connect: {
        rejectUnauthorized: false,
      },
    });
  });
});
