import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  migrate: vi.fn(),
  getSettings: vi.fn(async () => ({
    defaultUnitMappingId: null,
    mealieShoppingListId: null,
  })),
  startScheduler: vi.fn(),
  stopScheduler: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('./lib/grocy', () => ({}));
vi.mock('./lib/mealie', () => ({}));

vi.mock('drizzle-orm/better-sqlite3/migrator', () => ({
  migrate: mockState.migrate,
}));

vi.mock('./lib/db', () => ({
  db: {},
}));

vi.mock('./lib/config', () => ({
  config: {
    grocyDefaultUnitId: null,
    mealieShoppingListId: null,
  },
}));

vi.mock('./lib/logger', () => ({
  log: {
    warn: mockState.logWarn,
  },
}));

vi.mock('./lib/settings', () => ({
  getSettings: mockState.getSettings,
}));

vi.mock('./lib/sync/scheduler', () => ({
  startScheduler: mockState.startScheduler,
  stopScheduler: mockState.stopScheduler,
}));

describe('instrumentation register', () => {
  beforeEach(() => {
    vi.resetModules();
    mockState.migrate.mockReset();
    mockState.getSettings.mockClear();
    mockState.startScheduler.mockReset();
    mockState.stopScheduler.mockReset();
    mockState.logWarn.mockReset();
    process.env.NEXT_RUNTIME = 'nodejs';
  });

  it('registers shutdown hooks that stop the scheduler on normal process shutdown', async () => {
    const onceSpy = vi.spyOn(process, 'once').mockImplementation(
      ((..._args: Parameters<typeof process.once>) => process) as typeof process.once,
    );
    const { register } = await import('./instrumentation');

    await register();

    expect(mockState.startScheduler).toHaveBeenCalledTimes(1);
    expect(onceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(onceSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(onceSpy).toHaveBeenCalledWith('exit', expect.any(Function));

    const sigtermHandler = onceSpy.mock.calls.find(([event]) => event === 'SIGTERM')?.[1];
    expect(sigtermHandler).toBeTypeOf('function');

    sigtermHandler?.();

    expect(mockState.stopScheduler).toHaveBeenCalledTimes(1);

    onceSpy.mockRestore();
  });

  it('registers shutdown hooks only once even if instrumentation runs again', async () => {
    const onceSpy = vi.spyOn(process, 'once').mockImplementation(
      ((..._args: Parameters<typeof process.once>) => process) as typeof process.once,
    );
    const { register } = await import('./instrumentation');

    await register();
    await register();

    expect(onceSpy).toHaveBeenCalledTimes(3);

    onceSpy.mockRestore();
  });
});
