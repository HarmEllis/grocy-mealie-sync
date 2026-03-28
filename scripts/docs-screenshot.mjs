import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { Agent } from 'undici';

dotenv.config({ quiet: true });

const HOST = '127.0.0.1';
const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'images', 'app-dashboard.png');
const STARTUP_TIMEOUT_MS = 10_000;
const STEP_TIMEOUT_MS = 30_000;
const BUILD_TIMEOUT_MS = 5 * 60_000;
const SERVICE_CHECK_TIMEOUT_MS = 10_000;
const VIEWPORT = { width: 840, height: 1400 };
const GROCY_DEFAULT_URL = 'http://grocy:9283';
const MEALIE_DEFAULT_URL = 'http://mealie:9925';
const LOCALHOST_FALLBACK_HOSTS = ['localhost', '127.0.0.1'];
const DOCKER_HOST_ALIASES = new Set(['host.docker.internal', 'host-docker-internal']);

const chromiumCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  process.env.CHROMIUM_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/snap/bin/chromium',
].filter(Boolean);

const allowInsecureTls = parseBooleanEnv(process.env.ALLOW_INSECURE_TLS, false);
const requestDispatcher = allowInsecureTls
  ? new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    })
  : undefined;

function buildTargetUrl(port) {
  return `http://${HOST}:${port}`;
}

function parseBooleanEnv(value, defaultValue) {
  if (!value || value.trim() === '') {
    return defaultValue;
  }

  switch (value.trim().toLowerCase()) {
    case 'true':
    case '1':
      return true;
    case 'false':
    case '0':
      return false;
    default:
      return defaultValue;
  }
}

function getEnvOrDefault(name, fallback) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

function buildServiceUrl(baseUrl, pathname, searchParams = {}) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL(pathname.replace(/^\//, ''), normalizedBase);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function formatError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function requireConfiguredValue(name, value, serviceName) {
  if (value && value.trim() !== '') {
    return value.trim();
  }

  throw new Error(
    [
      `[DocsScreenshot] ${serviceName} check cannot run because ${name} is not configured.`,
      `Set ${name} and start ${serviceName} before running npm run docs:screenshot.`,
    ].join(' ')
  );
}

async function assertServiceReady({
  serviceName,
  url,
  headers,
  configHint,
}) {
  let response;

  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(SERVICE_CHECK_TIMEOUT_MS),
      ...(requestDispatcher ? { dispatcher: requestDispatcher } : {}),
    });
  } catch (error) {
    throw new ServiceCheckError(
      'network',
      [
        `[DocsScreenshot] ${serviceName} is not reachable.`,
        `Checked: ${url}`,
        `Reason: ${formatError(error)}`,
        `Start ${serviceName} and verify ${configHint} before running npm run docs:screenshot.`,
      ].join('\n')
    );
  }

  if (!response.ok) {
    throw new ServiceCheckError(
      'http',
      [
        `[DocsScreenshot] ${serviceName} is not ready for docs screenshots.`,
        `Checked: ${url}`,
        `Received: ${response.status} ${response.statusText}`,
        `Start ${serviceName} and verify ${configHint} before running npm run docs:screenshot.`,
      ].join('\n')
    );
  }

  await response.arrayBuffer();
}

class ServiceCheckError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

function buildBaseUrlCandidates(configuredBaseUrl) {
  const candidates = [configuredBaseUrl];
  const parsed = new URL(configuredBaseUrl);

  if (!DOCKER_HOST_ALIASES.has(parsed.hostname)) {
    return candidates;
  }

  for (const hostname of LOCALHOST_FALLBACK_HOSTS) {
    const fallbackUrl = new URL(parsed.toString());
    fallbackUrl.hostname = hostname;
    candidates.push(fallbackUrl.toString());
  }

  return candidates;
}

async function probeService({
  serviceName,
  baseUrl,
  pathname,
  searchParams,
  headers,
  configHint,
}) {
  const url = buildServiceUrl(baseUrl, pathname, searchParams);
  await assertServiceReady({
    serviceName,
    url,
    headers,
    configHint,
  });
}

async function resolveReachableServiceBaseUrl({
  serviceName,
  configuredBaseUrl,
  pathname,
  searchParams,
  headers,
  configHint,
}) {
  const candidates = buildBaseUrlCandidates(configuredBaseUrl);
  const networkFailures = [];

  for (const candidate of candidates) {
    try {
      await probeService({
        serviceName,
        baseUrl: candidate,
        pathname,
        searchParams,
        headers,
        configHint,
      });

      if (candidate !== configuredBaseUrl) {
        console.log(`[DocsScreenshot] ${serviceName} fallback succeeded via ${candidate}.`);
      }

      return candidate;
    } catch (error) {
      if (!(error instanceof ServiceCheckError)) {
        throw error;
      }

      if (error.kind === 'http') {
        throw error;
      }

      networkFailures.push(error.message);
    }
  }

  throw new Error(networkFailures.join('\n\n'));
}

async function resolveScreenshotDependencies() {
  const grocyUrl = getEnvOrDefault('GROCY_URL', GROCY_DEFAULT_URL);
  const mealieUrl = getEnvOrDefault('MEALIE_URL', MEALIE_DEFAULT_URL);
  const grocyApiKey = requireConfiguredValue('GROCY_API_KEY', process.env.GROCY_API_KEY, 'Grocy');
  const mealieApiToken = requireConfiguredValue('MEALIE_API_TOKEN', process.env.MEALIE_API_TOKEN, 'Mealie');

  console.log('Checking Grocy and Mealie reachability.');

  const resolvedGrocyUrl = await resolveReachableServiceBaseUrl({
    serviceName: 'Grocy',
    configuredBaseUrl: grocyUrl,
    pathname: '/api/system/info',
    headers: {
      'GROCY-API-KEY': grocyApiKey,
    },
    configHint: 'GROCY_URL and GROCY_API_KEY',
  });

  const resolvedMealieUrl = await resolveReachableServiceBaseUrl({
    serviceName: 'Mealie',
    configuredBaseUrl: mealieUrl,
    pathname: '/api/households/shopping/lists',
    searchParams: {
      page: 1,
      perPage: 1,
    },
    headers: {
      Authorization: `Bearer ${mealieApiToken}`,
    },
    configHint: 'MEALIE_URL and MEALIE_API_TOKEN',
  });

  console.log('Grocy and Mealie are reachable.');

  return {
    grocyUrl: resolvedGrocyUrl,
    mealieUrl: resolvedMealieUrl,
  };
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

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  return child;
}

function startPreviewServer(port, envOverrides) {
  return spawnNpmProcess(['run', 'start', '--', '--hostname', HOST, '--port', String(port)], envOverrides);
}

async function runProductionBuild(envOverrides) {
  console.log('Building production app.');
  const child = spawnNpmProcess(['run', 'build'], envOverrides);

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
  try {
    const serviceOverrides = await resolveScreenshotDependencies();
    await runProductionBuild({
      GROCY_URL: serviceOverrides.grocyUrl,
      MEALIE_URL: serviceOverrides.mealieUrl,
    });
    const port = await getAvailablePort();
    const targetUrl = buildTargetUrl(port);
    console.log('Starting production preview server.');
    const server = startPreviewServer(port, {
      GROCY_URL: serviceOverrides.grocyUrl,
      MEALIE_URL: serviceOverrides.mealieUrl,
    });
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
  } finally {
    await requestDispatcher?.close();
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
