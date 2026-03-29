import { beforeEach, describe, expect, it, vi } from 'vitest';
import packageMetadata from '../package.json';

const mockState = vi.hoisted(() => ({
  migrate: vi.fn(),
  initializeHistoryStorage: vi.fn(),
  getSettings: vi.fn(async () => ({
    defaultUnitMappingId: null,
    mealieShoppingListId: null,
  })),
  mcpEnabled: false,
  startScheduler: vi.fn(),
  stopScheduler: vi.fn(),
  logInfo: vi.fn(),
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

vi.mock('./lib/history-store', () => ({
  initializeHistoryStorage: mockState.initializeHistoryStorage,
}));

vi.mock('./lib/config', () => ({
  config: {
    get grocyDefaultUnitId() {
      return null;
    },
    get mealieShoppingListId() {
      return null;
    },
    get mcpEnabled() {
      return mockState.mcpEnabled;
    },
  },
}));

vi.mock('./lib/logger', () => ({
  log: {
    info: mockState.logInfo,
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
    mockState.initializeHistoryStorage.mockReset();
    mockState.initializeHistoryStorage.mockResolvedValue(undefined);
    mockState.getSettings.mockClear();
    mockState.mcpEnabled = false;
    mockState.startScheduler.mockReset();
    mockState.stopScheduler.mockReset();
    mockState.logInfo.mockReset();
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

  it('logs startup info only once when instrumentation runs multiple times', async () => {
    const { register } = await import('./instrumentation');

    await register();
    await register();

    expect(mockState.logInfo).toHaveBeenCalledTimes(2);
    expect(mockState.logInfo).toHaveBeenNthCalledWith(
      1,
      `[App] Starting ${packageMetadata.name} v${packageMetadata.version}`,
    );
    expect(mockState.logInfo).toHaveBeenNthCalledWith(
      2,
      '[MCP] Server disabled. Set MCP_ENABLED=true to enable /api/mcp',
    );
  });

  it('logs when the mcp server is enabled on startup', async () => {
    mockState.mcpEnabled = true;
    const { register } = await import('./instrumentation');

    await register();

    expect(mockState.logInfo).toHaveBeenCalledWith('[MCP] Server enabled at /api/mcp');
  });
});
