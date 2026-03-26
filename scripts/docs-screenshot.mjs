import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const PORT = 3000;
const TARGET_URL = `http://${HOST}:${PORT}`;
const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'images', 'app-dashboard.png');
const STARTUP_TIMEOUT_MS = 10_000;
const STEP_TIMEOUT_MS = 30_000;
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

async function canReachPreviewPage(timeoutMs) {
  try {
    const response = await fetch(TARGET_URL, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function waitForPreviewPage(timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canReachPreviewPage(2_000)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    [
      `Could not reach ${TARGET_URL}.`,
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

function startLocalServer() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(
    npmCommand,
    ['run', 'dev', '--', '--hostname', HOST, '--port', String(PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  return child;
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
  console.log('Starting local dev server.');
  const server = startLocalServer();

  try {
    await waitForPreviewPage(STARTUP_TIMEOUT_MS);

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

      await withTimeout(page.goto(TARGET_URL, { waitUntil: 'commit' }), STEP_TIMEOUT_MS, 'Page navigation');
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
