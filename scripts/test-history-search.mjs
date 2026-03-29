import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

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

function startDevServer(port) {
  return spawnNpmProcess(['run', 'dev', '--', '--hostname', HOST, '--port', String(port)], {
    AUTH_ENABLED: 'false',
    HISTORY_RETENTION_DAYS: '30',
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

async function main() {
  const port = await getAvailablePort();
  const targetUrl = buildTargetUrl(port);
  const server = startDevServer(port);

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
  }
}

await main();
