let shutdownHooksRegistered = false;

function registerSchedulerShutdownHooks(stopScheduler: () => void) {
  if (shutdownHooksRegistered) {
    return;
  }

  shutdownHooksRegistered = true;

  let stopped = false;
  const shutdown = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    stopScheduler();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.once('exit', shutdown);
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize API clients
    await import('./lib/grocy');
    await import('./lib/mealie');

    // Run DB migrations
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    const { db } = await import('./lib/db');
    migrate(db, { migrationsFolder: './drizzle' });

    const { initializeHistoryStorage } = await import('./lib/history-store');
    await initializeHistoryStorage();

    // Log config warnings
    const { config } = await import('./lib/config');
    const { log } = await import('./lib/logger');
    const { getSettings } = await import('./lib/settings');
    const settings = await getSettings();
    if (!settings.defaultUnitMappingId && !config.grocyDefaultUnitId) {
      log.warn('[Config] No default unit configured — new Mealie products will not be created in Grocy until a default unit is set in the web UI or via GROCY_DEFAULT_UNIT_ID');
    }
    if (!settings.mealieShoppingListId && !config.mealieShoppingListId) {
      log.warn('[Config] No Mealie shopping list configured — sync cannot add items to a shopping list until one is selected in the web UI or via MEALIE_SHOPPING_LIST_ID');
    }

    // Start the polling scheduler
    const { startScheduler, stopScheduler } = await import('./lib/sync/scheduler');
    registerSchedulerShutdownHooks(stopScheduler);
    startScheduler();
  }
}
