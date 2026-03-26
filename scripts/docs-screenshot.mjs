import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'images', 'app-dashboard.png');
const STARTUP_TIMEOUT_MS = 10_000;
const STEP_TIMEOUT_MS = 30_000;
const BUILD_TIMEOUT_MS = 5 * 60_000;
const VIEWPORT = { width: 840, height: 1400 };

const chromiumCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  process.env.CHROMIUM_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/snap/bin/chromium',
].filter(Boolean);

function buildTargetUrl(port) {
  return `http://${HOST}:${port}`;
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

async function canReachPreviewPage(targetUrl, timeoutMs) {
  try {
    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function waitForPreviewPage(targetUrl, child, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error('The docs preview server exited before it became reachable.');
    }

    if (await canReachPreviewPage(targetUrl, 2_000)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    [
      `Could not reach ${targetUrl}.`,
      'Failed to start the docs preview server.',
    ].join(' ')
  );
}

async function withTimeout(promise, timeoutMs, label) {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveChromiumExecutablePath() {
  return chromiumCandidates.find((candidate) => existsSync(candidate));
}

function spawnNpmProcess(args) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  return child;
}

function startPreviewServer(port) {
  return spawnNpmProcess(['run', 'start', '--', '--hostname', HOST, '--port', String(port)]);
}

async function runProductionBuild() {
  console.log('Building production app.');
  const child = spawnNpmProcess(['run', 'build']);

  const [exitCode, signal] = await withTimeout(once(child, 'exit'), BUILD_TIMEOUT_MS, 'Production build');
  if (exitCode !== 0) {
    throw new Error(
      signal
        ? `Production build failed with signal ${signal}.`
        : `Production build failed with exit code ${exitCode}.`
    );
  }

  console.log('Production build completed.');
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
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);

  return child.exitCode !== null;
}

async function stopLocalServer(child) {
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
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  await runProductionBuild();
  const port = await getAvailablePort();
  const targetUrl = buildTargetUrl(port);
  console.log('Starting production preview server.');
  const server = startPreviewServer(port);

  try {
    await waitForPreviewPage(targetUrl, server, STARTUP_TIMEOUT_MS);

    const executablePath = resolveChromiumExecutablePath();
    console.log('Launching Chromium.');

    const browser = await withTimeout(
      chromium.launch({
        headless: true,
        executablePath,
        args: ['--disable-dev-shm-usage', '--no-sandbox'],
      }),
      STEP_TIMEOUT_MS,
      'Chromium launch'
    );
    console.log('Chromium launched.');

    try {
      const page = await withTimeout(
        browser.newPage({
          viewport: VIEWPORT,
          deviceScaleFactor: 1,
        }),
        STEP_TIMEOUT_MS,
        'Page creation'
      );
      console.log('Page created.');

      await page.emulateMedia({
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      });

      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('theme', 'dark');
        } catch {
          // localStorage is not essential for this route.
        }
      });

      await withTimeout(page.goto(targetUrl, { waitUntil: 'commit' }), STEP_TIMEOUT_MS, 'Page navigation');
      console.log('Page loaded.');
      await withTimeout(
        page.waitForFunction(() => {
          return document.querySelectorAll('[data-slot="skeleton"]').length === 0;
        }),
        STEP_TIMEOUT_MS,
        'Settings load'
      );
      await page.waitForTimeout(300);

      await page.addStyleTag({
        content: `
          *,
          *::before,
          *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
          }

          html {
            color-scheme: dark !important;
          }
        `,
      });

      await page.evaluate(async () => {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';

        if ('fonts' in document) {
          await document.fonts.ready;
        }

        await new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });
      });

      await page.waitForTimeout(250);
      await withTimeout(
        page.screenshot({
          path: OUTPUT_PATH,
          fullPage: true,
          animations: 'disabled',
        }),
        STEP_TIMEOUT_MS,
        'Screenshot capture'
      );
      console.log(`Saved screenshot to ${path.relative(process.cwd(), OUTPUT_PATH)}.`);

      await withTimeout(page.close(), STEP_TIMEOUT_MS, 'Page close');
      console.log('Page closed.');
    } finally {
      await withTimeout(browser.close(), STEP_TIMEOUT_MS, 'Browser close');
      console.log('Browser closed.');
    }
  } finally {
    await stopLocalServer(server);
    console.log('Dev server stopped.');
  }
}

let exitCode = 0;

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  process.exit(exitCode);
}
