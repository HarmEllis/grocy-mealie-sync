export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize API clients
    await import('./lib/grocy');
    await import('./lib/mealie');

    // Run DB migrations
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    const { db } = await import('./lib/db');
    migrate(db, { migrationsFolder: './drizzle' });

    // Start the polling scheduler
    const { startScheduler } = await import('./lib/sync/scheduler');
    startScheduler();
  }
}
