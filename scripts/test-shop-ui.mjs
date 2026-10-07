// Browser smoke test of the shop plugin UI against a real, isolated backend:
// token issuing, hiding and rotation in Settings, and the Shopping page tabs.
// Grocy and Mealie point at an unreachable address and the database is a
// throwaway file, so nothing outside this test is touched.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const dbFile = `shop-ui-${randomUUID().slice(0, 8)}.db`;

const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port: free } = server.address();
    server.close(() => resolve(free));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn('node', ['server.mjs', '--dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: root,
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    AUTH_ENABLED: 'false',
    GROCY_URL: 'http://127.0.0.1:1',
    GROCY_API_KEY: 'test-only',
    MEALIE_URL: 'http://127.0.0.1:1',
    MEALIE_API_TOKEN: 'test-only',
    MEALIE_SHOPPING_LIST_ID: '',
    HEALTHCHECKS_PING_URL: '',
    NOTIFICATION_WEBHOOK_URL: '',
    MCP_ENABLED: 'false',
    HISTORY_RETENTION_DAYS: '-1',
    DATABASE_PATH: `./data/${dbFile}`,
  },
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
const serverExited = new Promise(resolve => server.once('exit', resolve));

let browser;
try {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('The dev server exited during startup');
    try {
      if ((await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) })).status === 200) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  // Settings: issue a token, hide it, rotate it.
  await page.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.getByLabel('Plugin installation name').fill('Demo shop');
  await page.getByRole('button', { name: 'Add plugin' }).click();
  const tokenBox = page.getByTestId('plugin-token');
  await tokenBox.waitFor({ timeout: 30_000 });
  const firstToken = (await tokenBox.textContent())?.trim() ?? '';
  assert.match(firstToken, /^gmsp_[a-f0-9]{24}_/, 'the new token is shown once');
  assert.ok((await page.locator('pre').first().textContent())?.includes(firstToken), 'the compose snippet contains the token');
  await page.getByRole('button', { name: 'I stored the token' }).click();
  await tokenBox.waitFor({ state: 'detached' });
  const installation = page.getByTestId('plugin-installation').filter({ hasText: 'Demo shop' });
  await installation.waitFor();
  assert.ok((await installation.textContent())?.includes('offline'), 'the new installation is listed as offline');
  assert.ok(!(await page.content()).includes(firstToken), 'the token is gone after hiding it');

  await installation.getByRole('button', { name: 'Rotate token' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await tokenBox.waitFor({ timeout: 30_000 });
  const rotatedToken = (await tokenBox.textContent())?.trim() ?? '';
  assert.match(rotatedToken, /^gmsp_[a-f0-9]{24}_/);
  assert.notEqual(rotatedToken, firstToken, 'rotation issues a different token');
  assert.equal(rotatedToken.slice(0, 29), firstToken.slice(0, 29), 'rotation keeps the installation');

  // The installation API exposes the rotated token's hint, never its value.
  const listed = await (await fetch(`${baseUrl}/api/plugins/installations`)).json();
  assert.equal(listed.installations.length, 1);
  assert.equal(listed.installations[0].tokenHint, rotatedToken.slice(-4));
  assert.ok(!JSON.stringify(listed).includes(rotatedToken), 'listing never exposes the token');

  // Sign-in failures stay visible, clear secrets and require a fresh step.
  await page.route('**/api/plugins/installations', route => route.fulfill({ json: {
    installations: [{ ...listed.installations[0], connected: true, capabilities: ['auth'] }],
  } }));
  let beginCount = 0;
  let submitCount = 0;
  await page.route('**/api/plugins/installations/*/auth', route => {
    const body = route.request().postDataJSON();
    if (body.action === 'begin') {
      beginCount++;
      return route.fulfill({ json: { step: { stepId: `synthetic-step-${beginCount}`, kind: 'form', title: 'Synthetic retailer sign-in',
        fields: [{ name: 'code', label: 'Login code', type: 'password', secret: true, required: true }] } } });
    }
    submitCount++;
    return route.fulfill({ status: 502, json: { error: 'The retailer rejected the login code. Start a new login.', code: 'UNAUTHENTICATED', outcome: 'not_applied', retryable: false } });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Retailer sign-in' }).click();
  await page.getByLabel('Login code').fill('synthetic-single-use-code');
  const initialBeginCount = beginCount;
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'The retailer rejected the login code.' }).waitFor();
  assert.equal(await page.getByLabel('Login code').count(), 0, 'the stale form and secret are removed');
  await page.getByRole('button', { name: 'Start a new sign-in', exact: true }).click();
  await page.getByLabel('Login code').waitFor();
  assert.equal(await page.getByLabel('Login code').inputValue(), '');
  assert.equal(beginCount, initialBeginCount + 1);
  assert.equal(submitCount, 1, 'starting over never replays the failed code');
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  await page.unroute('**/api/plugins/installations');
  await page.unroute('**/api/plugins/installations/*/auth');

  // Shopping page: every tab hydrates and renders.
  await page.goto(`${baseUrl}/shopping`, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.getByRole('heading', { name: 'Shopping' }).first().waitFor();
  await page.getByText('Demo shop').first().waitFor();
  for (const [tab, marker] of [
    ['Products', 'Connect a plugin first'],
    ['Receipts', 'No receipts stored yet.'],
    ['Review', 'Nothing to review.'],
    ['Overview', 'Nothing exported.'],
  ]) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
    await page.getByText(marker).first().waitFor({ timeout: 30_000 });
  }

  // Revoke from Settings.
  await page.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.getByTestId('plugin-installation').filter({ hasText: 'Demo shop' }).getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByText('No shop plugins yet.').waitFor({ timeout: 30_000 });

  assert.deepEqual(pageErrors, [], 'no client-side errors');
  console.log('Shop UI: token issuing, hiding, rotation, revocation and Shopping tabs passed.');
} catch (error) {
  console.error(error);
  console.error('----- server output (last 6000 characters) -----');
  console.error(serverLog.slice(-6000));
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    const stopped = await Promise.race([serverExited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 15_000))]);
    if (!stopped) {
      try { process.kill(-server.pid, 'SIGKILL'); } catch {}
    }
  }
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(path.join(root, 'data', `${dbFile}${suffix}`), { force: true });
}
