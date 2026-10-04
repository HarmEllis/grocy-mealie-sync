import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { chromium, devices } from 'playwright';

const HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 30_000;
const SEARCH_TEXT = 'abcdef';
const KEY_DELAY_MS = 300;

async function getAvailablePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not determine an available port.')));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

function spawnNpmProcess(args, envOverrides = {}) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...envOverrides,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', chunk => process.stdout.write(chunk));
  child.stderr.on('data', chunk => process.stderr.write(chunk));

  return child;
}

function startDevServer(port, databasePath) {
  return spawnNpmProcess(['run', 'dev', '--', '--hostname', HOST, '--port', String(port)], {
    AUTH_ENABLED: 'false',
    HISTORY_RETENTION_DAYS: '30',
    DATABASE_PATH: databasePath,
    GROCY_URL: 'http://127.0.0.1:1', MEALIE_URL: 'http://127.0.0.1:1',
    GROCY_API_KEY: 'history-test', MEALIE_API_TOKEN: 'history-test',
  });
}

function createTestDatabase() {
  fs.mkdirSync('data', { recursive: true });
  const directory = fs.mkdtempSync(path.resolve('data/history-playwright-'));
  const databasePath = path.join(directory, 'sync.db');
  const sqlite = new Database(databasePath);
  try {
    migrate(drizzle(sqlite), { migrationsFolder: path.resolve('drizzle') });
    // Keep the real scheduler passive; this test exercises only the history UI.
    sqlite.prepare('INSERT INTO runtime_locks (name, owner_id, expires_at) VALUES (?, ?, ?)')
      .run('scheduler-startup', 'playwright-history', Date.now() + 3_600_000);
    const now = Math.floor(Date.now() / 1000);
    const insertRun = sqlite.prepare('INSERT INTO history_runs (id, trigger, action, status, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)');
    const insertEvent = sqlite.prepare('INSERT INTO history_events (id, run_id, level, kind, category, entity_kind, product_name, source, target, reason, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const add = (id, trigger, kind, product, source, target, message, reason, time = now) => {
      insertRun.run(id, trigger, trigger === 'scanner' ? 'inventory_consume_stock' : 'scheduler_cycle', kind === 'issue' ? 'failure' : 'success', time, time);
      insertEvent.run(`event-${id}`, id, kind === 'issue' ? 'error' : 'info', kind, 'inventory', 'product', product, source, target, reason, message, time * 1000);
    };
    add('milk-purchase', 'scheduler', 'mutation', 'Milk', 'Mealie', 'Grocy', 'Added 2 to Grocy stock for "Milk".', 'Milk was checked off on the Mealie shopping list.');
    add('milk-scanner', 'scanner', 'mutation', 'Milk', 'Scanner', 'Grocy', 'Consumed 1 from Grocy stock for "Milk".', 'Consume requested on the scanner.');
    add('milk-error', 'scheduler', 'issue', 'Milk', 'Grocy', 'Mealie', 'Could not update the Mealie shopping list for "Milk".', 'Mealie could not be reached.');
    add('rice-purchase', 'scheduler', 'mutation', 'Rice', 'Mealie', 'Grocy', 'Added 1 to Grocy stock for "Rice".', 'Rice was checked off in Mealie.');
    for (let index = 0; index < 51; index++) add(`bread-${index}`, 'scheduler', 'mutation', 'Bread', 'Grocy', 'Mealie', `Added Bread to the Mealie shopping list (${index}).`, 'Grocy stock fell below the minimum.', now - 100 - index);
    add('quiet', 'scheduler', 'diagnostic', null, null, null, 'Sync completed with no changes.', '', now + 1);
    return { directory, databasePath };
  } finally {
    sqlite.close();
  }
}

function buildTargetUrl(port) {
  return `http://${HOST}:${port}`;
}

async function canReachPage(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForPage(url, child, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error('The dev server exited before it became reachable.');
    }

    if (await canReachPage(url, 1_500)) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Could not reach ${url} within ${timeoutMs}ms.`);
}

function terminateProcessTree(child, signal) {
  if (child.exitCode !== null || !child.pid) {
    return;
  }

  try {
    if (process.platform === 'win32') {
      child.kill(signal);
      return;
    }

    process.kill(-child.pid, signal);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
      return;
    }

    throw error;
  }
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return true;
  }

  await Promise.race([
    once(child, 'exit'),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ]);

  return child.exitCode !== null;
}

async function stopServer(child) {
  if (child.exitCode !== null) {
    return;
  }

  terminateProcessTree(child, 'SIGTERM');

  if (await waitForExit(child, 5_000)) {
    return;
  }

  terminateProcessTree(child, 'SIGKILL');
  await waitForExit(child, 5_000);
}

async function main() {
  const port = await getAvailablePort();
  const targetUrl = buildTargetUrl(port);
  const testDatabase = createTestDatabase();
  const server = startDevServer(port, testDatabase.databasePath);

  try {
    await waitForPage(`${targetUrl}/history`, server, STARTUP_TIMEOUT_MS);

    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });

    try {
      const context = await browser.newContext({
        ...devices['iPhone 12'],
        locale: 'nl-NL',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);

      await page.goto(`${targetUrl}/history`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2_000);
      if (await page.locator('article').count() !== 50) throw new Error('Expected a full page of 50 individual changes.');
      if (await page.getByText('Sync completed with no changes.').count()) throw new Error('Routine sync diagnostics should be hidden.');
      await page.getByRole('link', { name: 'Older activity' }).click();
      await page.waitForURL('**/history?page=2');
      if (await page.locator('article').count() !== 5) throw new Error('Expected older activity to remain accessible on page 2.');
      await page.getByLabel('Search history').fill('Milk');
      await page.waitForURL('**/history?q=Milk');
      if (await page.locator('article').count() !== 3) throw new Error('Product search should show only the three Milk changes and issues.');
      if (await page.locator('article').filter({ hasText: 'Rice' }).count()) throw new Error('Product search must not include other products from sync runs.');
      await page.getByLabel('Filter by trigger').click();
      await page.getByRole('option', { name: 'Scanner', exact: true }).click();
      await page.waitForURL('**trigger=scanner**');
      if (await page.locator('article').count() !== 1) throw new Error('Expected only the scanner consumption.');
      await page.getByRole('link', { name: 'Related changes' }).click();
      await page.waitForURL('**/history/milk-scanner#event-milk-scanner');
      if (!await page.getByText('Consume requested on the scanner.', { exact: true }).isVisible()) throw new Error('Related changes must preserve the scanner cause.');
      await page.goto(`${targetUrl}/history?kind=issue&q=Milk`, { waitUntil: 'domcontentloaded' });
      if (await page.locator('article').count() !== 1) throw new Error('Expected only the Milk sync issue.');
      await page.goto(`${targetUrl}/history?q=Milk`, { waitUntil: 'domcontentloaded' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (overflow) throw new Error('History should fit the mobile viewport without horizontal scrolling.');
      if (process.env.PLAYWRIGHT_ARTIFACT_DIR) {
        fs.mkdirSync(process.env.PLAYWRIGHT_ARTIFACT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.PLAYWRIGHT_ARTIFACT_DIR, 'history-mobile.png'), fullPage: true, caret: 'initial' });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({ path: path.join(process.env.PLAYWRIGHT_ARTIFACT_DIR, 'history-desktop.png'), fullPage: true, caret: 'initial' });
      }

      const input = page.getByLabel('Search history');
      await input.click();
      await input.fill('');
      await page.keyboard.type(SEARCH_TEXT, { delay: KEY_DELAY_MS });
      await page.waitForTimeout(1_500);

      const value = await input.inputValue();
      const urlSearch = new URL(page.url()).searchParams.get('q') ?? '';

      if (value !== SEARCH_TEXT) {
        throw new Error(`Expected the history search input to keep "${SEARCH_TEXT}", but got "${value}".`);
      }

      if (urlSearch !== SEARCH_TEXT) {
        throw new Error(`Expected the history URL query to be "${SEARCH_TEXT}", but got "${urlSearch}".`);
      }

      console.log(
        `[Playwright] History search kept all characters while typing at ${KEY_DELAY_MS}ms per key.`,
      );
      await context.close();
    } finally {
      await browser.close();
    }
  } finally {
    await stopServer(server);
    fs.rmSync(testDatabase.directory, { recursive: true, force: true });
  }
}

await main();
