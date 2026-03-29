import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

import { chromium, devices } from 'playwright';

const HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 30_000;
const MOBILE_INPUT_MIN_WIDTH_PX = 180;

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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mealieUnits: [],
        unmappedMealieUnits: [],
        grocyUnits: [],
        existingUnitMappings: [],
        unitSuggestions: {},
        orphanGrocyUnitCount: 0,
      }),
    });
  });

  await page.route('**/api/mapping-wizard/products/mapped', async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

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
            currentStock: 5,
            minStockAmount: 2,
            isBelowMinimum: false,
          },
        ],
      }),
    });
  });
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
      const context = await browser.newContext({
        ...devices['iPhone SE'],
        locale: 'nl-NL',
      });
      const page = await context.newPage();

      await configureRoutes(page);

      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3_000);

      await page.getByRole('button', { name: 'Mapping Wizard' }).click();
      await page.getByRole('tab', { name: 'Mapped Products' }).click();

      const input = page.locator('input[type="number"]').first();
      await input.waitFor();

      const metrics = await input.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          inputWidth: rect.width,
          viewportWidth: window.innerWidth,
        };
      });

      await input.fill('1234');
      const value = await input.inputValue();

      if (metrics.inputWidth < MOBILE_INPUT_MIN_WIDTH_PX) {
        throw new Error(
          `Expected the mobile minimum-stock input to be at least ${MOBILE_INPUT_MIN_WIDTH_PX}px wide,`
          + ` but it rendered at ${metrics.inputWidth}px on a ${metrics.viewportWidth}px viewport.`,
        );
      }

      if (value !== '1234') {
        throw new Error(`Expected the minimum-stock input to accept "1234", but got "${value}".`);
      }

      console.log(
        `[Playwright] Mobile min-stock input is ${metrics.inputWidth}px wide and accepts typed values.`,
      );
    } finally {
      await browser.close();
    }
  } finally {
    await stopServer(server);
  }
}

await main();
