import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 30_000;

const settingsBody = {
  defaultUnitMappingId: null,
  mealieShoppingListId: null,
  autoCreateProducts: false,
  autoCreateUnits: false,
  ensureLowStockOnMealieList: false,
  syncMealieInPossession: false,
  mealieInPossessionOnlyAboveMinStock: false,
  mappingWizardMinStockStep: '1',
  stockOnlyMinStock: false,
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
  },
  availableUnits: [],
  availableShoppingLists: [],
};

const conflictsBody = {
  conflicts: [
    {
      id: 'conflict-1',
      conflictKey: 'product:1',
      type: 'Duplicate mapping',
      status: 'open',
      severity: 'high',
      mappingKind: 'product',
      mappingId: 'mapping-1',
      sourceTab: 'products',
      mealieId: 'food-1',
      mealieName: 'Milk',
      grocyId: 101,
      grocyName: 'Milk',
      summary: 'Milk is mapped to multiple Grocy products',
      occurrences: 2,
      firstSeenAt: '2026-03-28T10:00:00.000Z',
      lastSeenAt: '2026-03-29T10:00:00.000Z',
      resolvedAt: null,
    },
  ],
};

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
  });
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

async function configureRoutes(page) {
  const requestCounts = {
    units: 0,
    products: 0,
    grocyMinStock: 0,
    mappedProducts: 0,
    conflicts: 0,
  };

  await page.route('**/api/settings', async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(settingsBody),
    });
  });

  await page.route('**/api/mapping-wizard/data?tab=units', async route => {
    requestCounts.units += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mealieUnits: [
          { id: 'unit-1', name: 'Bottle', abbreviation: 'bt' },
        ],
        unmappedMealieUnits: [
          { id: 'unit-1', name: 'Bottle', abbreviation: 'bt' },
        ],
        grocyUnits: [
          { id: 10, name: 'Bottle' },
        ],
        existingUnitMappings: [],
        unitSuggestions: {},
        orphanGrocyUnitCount: 0,
      }),
    });
  });

  await page.route('**/api/mapping-wizard/data?tab=products', async route => {
    requestCounts.products += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unmappedMealieFoods: [
          { id: 'food-1', name: 'Milk' },
        ],
        grocyProducts: [
          { id: 101, name: 'Milk', quIdPurchase: 10, minStockAmount: 2 },
        ],
        grocyUnits: [
          { id: 10, name: 'Bottle' },
        ],
        existingUnitMappings: [
          {
            id: 'unit-map-1',
            mealieUnitId: 'unit-1',
            mealieUnitName: 'Bottle',
            mealieUnitAbbreviation: 'bt',
            grocyUnitId: 10,
            grocyUnitName: 'Bottle',
          },
        ],
        productSuggestions: {},
        orphanGrocyProductCount: 0,
      }),
    });
  });

  await page.route('**/api/mapping-wizard/data?tab=grocy-min-stock', async route => {
    requestCounts.grocyMinStock += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        minStockStep: '1',
        unmappedGrocyMinStockProducts: [
          {
            id: 101,
            name: 'Milk',
            quIdPurchase: 10,
            minStockAmount: 2,
            currentStock: 0,
            isBelowMinimum: true,
          },
        ],
        grocyUnits: [
          { id: 10, name: 'Bottle' },
        ],
        unmappedMealieFoods: [
          { id: 'food-1', name: 'Milk' },
        ],
        lowStockGrocyProductSuggestions: {},
      }),
    });
  });

  await page.route('**/api/mapping-wizard/products/mapped', async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    requestCounts.mappedProducts += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        minStockStep: '1',
        mappedProducts: [
          {
            id: 'mapping-1',
            grocyProductId: 101,
            name: 'Milk',
            unitName: 'Bottle',
            currentStock: 1,
            minStockAmount: 2,
            isBelowMinimum: true,
          },
        ],
      }),
    });
  });

  await page.route('**/api/mapping-wizard/conflicts', async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    requestCounts.conflicts += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(conflictsBody),
    });
  });

  return requestCounts;
}

function waitForGet(page, path) {
  return page.waitForResponse(response =>
    response.request().method() === 'GET'
    && new URL(response.url()).pathname + new URL(response.url()).search === path,
  );
}

async function openTab(page, tabName, endpointPath) {
  await Promise.all([
    waitForGet(page, endpointPath),
    page.getByRole('tab', { name: tabName }).click(),
  ]);
}

async function refreshCurrentTab(page, buttonName, endpointPath, getCount, expectedCount) {
  const refreshButton = page.locator('[data-slot="dialog-footer"]').first().getByRole('button', { name: buttonName });
  await refreshButton.waitFor();

  await Promise.all([
    waitForGet(page, endpointPath),
    refreshButton.click(),
  ]);

  const actualCount = getCount();
  if (actualCount !== expectedCount) {
    throw new Error(`Expected ${buttonName} to trigger ${expectedCount} requests for ${endpointPath}, but saw ${actualCount}.`);
  }
}

async function main() {
  const port = await getAvailablePort();
  const targetUrl = buildTargetUrl(port);
  const server = startDevServer(port);

  try {
    await waitForPage(targetUrl, server, STARTUP_TIMEOUT_MS);

    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });

    try {
      const page = await browser.newPage({ locale: 'nl-NL' });
      page.setDefaultTimeout(20_000);

      const requestCounts = await configureRoutes(page);

      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3_000);

      await Promise.all([
        waitForGet(page, '/api/mapping-wizard/data?tab=units'),
        page.getByRole('button', { name: 'Mapping Wizard' }).click(),
      ]);

      await refreshCurrentTab(
        page,
        'Refresh Units',
        '/api/mapping-wizard/data?tab=units',
        () => requestCounts.units,
        2,
      );

      await openTab(page, /^Products/, '/api/mapping-wizard/data?tab=products');
      await refreshCurrentTab(
        page,
        'Refresh Products',
        '/api/mapping-wizard/data?tab=products',
        () => requestCounts.products,
        2,
      );

      await openTab(page, /^Grocy Min Stock/, '/api/mapping-wizard/data?tab=grocy-min-stock');
      await refreshCurrentTab(
        page,
        'Refresh Grocy Min Stock',
        '/api/mapping-wizard/data?tab=grocy-min-stock',
        () => requestCounts.grocyMinStock,
        2,
      );

      await openTab(page, /^Mapped Products/, '/api/mapping-wizard/products/mapped');
      await refreshCurrentTab(
        page,
        'Refresh Mapped Products',
        '/api/mapping-wizard/products/mapped',
        () => requestCounts.mappedProducts,
        2,
      );

      await openTab(page, /^Conflicts/, '/api/mapping-wizard/conflicts');
      await refreshCurrentTab(
        page,
        'Refresh Conflicts',
        '/api/mapping-wizard/conflicts',
        () => requestCounts.conflicts,
        2,
      );

      console.log('[Playwright] Mapping wizard refresh buttons reloaded all tab datasets.');
    } finally {
      await browser.close();
    }
  } finally {
    await stopServer(server);
  }
}

await main();
