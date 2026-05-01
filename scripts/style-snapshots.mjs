import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 45_000;
const NAVIGATION_TIMEOUT_MS = 25_000;
const STEP_DELAY_MS = 700;

const argLabel = process.argv.find(arg => arg.startsWith('--label='));
const runLabel = (argLabel ? argLabel.slice('--label='.length) : 'before').trim() || 'before';
const outputDir = path.join(process.cwd(), 'artifacts', 'style-snapshots', runLabel);

const STATIC_ROUTES = [
  { path: '/', file: 'dashboard.png' },
  { path: '/mapping', file: 'mapping.png' },
  { path: '/history', file: 'history.png' },
  { path: '/settings', file: 'settings.png' },
  { path: '/api-endpoints', file: 'api-endpoints.png' },
  { path: '/login', file: 'login.png' },
];

const SETTINGS_BODY = {
  defaultUnitMappingId: 'unit-map-1',
  mealieShoppingListId: 'list-2',
  autoCreateProducts: false,
  autoCreateUnits: false,
  ensureLowStockOnMealieList: false,
  syncMealieInPossession: false,
  mealieInPossessionOnlyAboveMinStock: false,
  mappingWizardMinStockStep: '1',
  stockOnlyMinStock: false,
  cleanupCheckedItemsAfterHours: -1,
  cleanupCheckedItemsMode: 'all',
  syncSubProducts: false,
  syncParentOwnStock: false,
  locks: {
    defaultUnitMappingId: { locked: false, envVar: 'GROCY_DEFAULT_UNIT_ID', envValue: null },
    mealieShoppingListId: { locked: false, envVar: 'MEALIE_SHOPPING_LIST_ID', envValue: null },
    autoCreateProducts: { locked: false, envVar: 'AUTO_CREATE_PRODUCTS', envValue: null },
    autoCreateUnits: { locked: false, envVar: 'AUTO_CREATE_UNITS', envValue: null },
    ensureLowStockOnMealieList: { locked: false, envVar: 'ENSURE_LOW_STOCK_ON_MEALIE_LIST', envValue: null },
    syncMealieInPossession: { locked: false, envVar: 'SYNC_MEALIE_IN_POSSESSION', envValue: null },
    mealieInPossessionOnlyAboveMinStock: {
      locked: false,
      envVar: 'MEALIE_IN_POSSESSION_ONLY_ABOVE_MIN_STOCK',
      envValue: null,
    },
    mappingWizardMinStockStep: { locked: false, envVar: 'MAPPING_WIZARD_MIN_STOCK_STEP', envValue: null },
    stockOnlyMinStock: { locked: false, envVar: 'STOCK_ONLY_MIN_STOCK', envValue: null },
    cleanupCheckedItemsAfterHours: { locked: false, envVar: 'CLEANUP_CHECKED_ITEMS_AFTER_HOURS', envValue: null },
    cleanupCheckedItemsMode: { locked: false, envVar: 'CLEANUP_CHECKED_ITEMS_MODE', envValue: null },
    syncSubProducts: { locked: false, envVar: 'SYNC_SUB_PRODUCTS', envValue: null },
    syncParentOwnStock: { locked: false, envVar: 'SYNC_PARENT_OWN_STOCK', envValue: null },
  },
  availableUnits: [
    {
      id: 'unit-map-1',
      name: 'Bottle',
      abbreviation: 'bt',
      grocyUnitId: 10,
      grocyUnitName: 'Bottle',
    },
    {
      id: 'unit-map-2',
      name: 'Carton',
      abbreviation: 'ct',
      grocyUnitId: 11,
      grocyUnitName: 'Carton',
    },
  ],
  availableShoppingLists: [
    { id: 'list-1', name: 'Groceries' },
    { id: 'list-2', name: 'Weekend' },
  ],
};

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

function startDevServer(port) {
  return spawnNpmProcess(['run', 'dev', '--', '--hostname', HOST, '--port', String(port)], {
    AUTH_ENABLED: 'false',
    HISTORY_RETENTION_DAYS: '30',
  });
}

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

      server.close(error => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
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

async function configureRoutes(page) {
  await page.route('**/api/status', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lastGrocyPoll: '2026-01-10T12:00:00.000Z',
        lastMealiePoll: '2026-01-10T12:02:00.000Z',
        grocyBelowMinStockCount: 3,
        mealieTrackedItemsCount: 7,
      }),
    });
  });

  await page.route('**/api/settings', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SETTINGS_BODY),
      });
      return;
    }

    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/mapping-wizard/**', async route => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unavailable in screenshot mode' }),
    });
  });

  await page.route('**/api/sync/**', async route => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unavailable in screenshot mode' }),
    });
  });
}

function sanitizeHistoryDetailId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

async function screenshotRoute(page, baseUrl, routePath, outputPath) {
  await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
  await page.waitForTimeout(STEP_DELAY_MS);

  await page.screenshot({
    path: outputPath,
    fullPage: true,
    animations: 'disabled',
  });
}

async function maybeScreenshotHistoryDetail(page, baseUrl) {
  await page.goto(`${baseUrl}/history`, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
  await page.waitForTimeout(STEP_DELAY_MS);

  const firstDetailsLink = page.locator('a[href^="/history/"]').first();
  if (await firstDetailsLink.count() === 0) {
    return null;
  }

  const href = await firstDetailsLink.getAttribute('href');
  if (!href) {
    return null;
  }

  await page.goto(`${baseUrl}${href}`, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
  await page.waitForTimeout(STEP_DELAY_MS);

  const runId = href.split('/').pop() ?? 'detail';
  const fileName = `history-${sanitizeHistoryDetailId(runId)}.png`;
  const filePath = path.join(outputDir, fileName);
  await page.screenshot({
    path: filePath,
    fullPage: true,
    animations: 'disabled',
  });

  return fileName;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const port = await getAvailablePort();
  const targetUrl = `http://${HOST}:${port}`;
  const server = startDevServer(port);

  try {
    await waitForPage(targetUrl, server, STARTUP_TIMEOUT_MS);

    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });

    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });

      await context.addInitScript(() => {
        window.localStorage.setItem('gms:theme', 'dark');
        window.localStorage.setItem('gms:accent', 'amber');
      });

      const page = await context.newPage();
      page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);

      await configureRoutes(page);

      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
          }
        `,
      }).catch(() => {
        // Added again per-page via screenshot options if this runs too early.
      });

      for (const route of STATIC_ROUTES) {
        const filePath = path.join(outputDir, route.file);
        await screenshotRoute(page, targetUrl, route.path, filePath);
      }

      const detailFile = await maybeScreenshotHistoryDetail(page, targetUrl);

      const summary = {
        label: runLabel,
        createdAt: new Date().toISOString(),
        baseUrl: targetUrl,
        files: [
          ...STATIC_ROUTES.map(route => route.file),
          ...(detailFile ? [detailFile] : []),
        ],
      };

      await fs.writeFile(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
      await context.close();
    } finally {
      await browser.close();
    }
  } finally {
    await stopServer(server);
  }

  console.log(`Saved style snapshots to ${path.relative(process.cwd(), outputDir)}`);
}

await main();
