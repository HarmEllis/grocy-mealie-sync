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
  await page.setViewportSize({ width: 360, height: 900 });
  await assertNoPageOverflow('360px Settings token');
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
  await assertNoPageOverflow('360px retailer sign-in');
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
  await page.setViewportSize({ width: 1280, height: 1000 });

  // Automatically discovered ingredients and proposals are visible without a manual catalogue search.
  const realOverview = await (await fetch(`${baseUrl}/api/shop/overview`)).json();
  await page.route('**/api/shop/overview', route => route.fulfill({ json: { ...realOverview,
    installations: realOverview.installations.map(item => ({ ...item, providerId: 'synthetic-shop' })),
  } }));
  await page.route('**/api/shop/mappings?*', route => route.fulfill({ json: {
    searches: [{ id: 'synthetic-search', targetName: 'Cherry tomaten', status: 'complete', resultCount: 1, lastError: null }],
    products: [{ providerId: 'synthetic-shop', externalId: '123', name: 'Synthetic cherry tomatoes', packageAmount: 250, packageUnit: 'g', measure: 'unit' }],
    suggestions: [{ id: 'synthetic-suggestion', retailerProductId: '123', targetKind: 'grocy_product', targetId: '1', targetName: 'Cherry tomaten', score: 0.9 }],
    mappings: [],
  } }));
  await page.goto(`${baseUrl}/shopping`, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.getByRole('tab', { name: 'Products', exact: true }).click();
  await page.getByText('Shopping ingredients to map', { exact: true }).waitFor();
  await page.getByText('Found 1 products; review the suggestions or use Map below').waitFor();
  await page.getByRole('button', { name: 'Accept', exact: true }).waitFor();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Search again', 'Reject']) {
      const button = page.getByRole('button', { name, exact: true });
      const gap = await button.evaluate(node => node.closest('li').getBoundingClientRect().right - node.getBoundingClientRect().right);
      // 12px row padding + 1px border + 4px rounding tolerance.
      assert.ok(gap <= 17, `${width}px: ${name} is right aligned (${gap}px)`);
    }
  }
  assert.equal(await page.getByRole('button', { name: 'Confirm', exact: true }).count(), 0, 'catalogue proposals are not confirmed mappings');
  async function chooseOption(label, option) {
    await page.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  }
  // Populated mobile layouts must stay within the viewport, including mapping controls.
  const mobileProduct = { providerId: 'synthetic-shop', externalId: '123', name: 'Synthetic cherry tomatoes with a deliberately long product name', packageAmount: 250, packageUnit: 'g', measure: 'unit' };
  let mobileRole = 'alternative';
  let mealieMode = false;
  let unitResponseGate = null;
  let confirmedAmount = null;
  let extraProducts = [];
  let extraSuggestions = [];
  await page.unroute('**/api/shop/mappings?*');
  await page.route('**/api/shop/mappings?*', route => route.fulfill({ json: {
    products: [mobileProduct, { ...mobileProduct, externalId: '456', name: 'Aubergine' }, ...extraProducts], suggestions: extraSuggestions, searches: [],
    mappings: [{ id: 'mobile-mapping', providerId: 'synthetic-shop', retailerProductId: '123', retailerProductName: mobileProduct.name,
      targetKind: mealieMode ? 'mealie_food' : 'grocy_product', targetId: '79', packageBaseUnitId: '11', targetName: 'Cherry tomaten', role: mobileRole, packageBaseAmount: confirmedAmount,
      packageBaseUnitName: 'Doos', confirmed: confirmedAmount !== null }],
  } }));
  await page.route('**/api/shop/mappings/mobile-mapping', route => {
    const body = route.request().postDataJSON();
    if (body.role) mobileRole = body.role;
    if (body.packageBaseAmount) confirmedAmount = body.packageBaseAmount;
    return route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/shop/targets?*', async route => {
    if (unitResponseGate) await unitResponseGate;
    await route.fulfill({ json: {
      targets: [{ kind: mealieMode ? 'mealie_food' : 'grocy_product', id: '79', name: 'Cherry tomaten', baseUnitId: '11', baseUnitName: 'Doos' }], mealieUnits: [],
    } });
  });
  await page.unroute('**/api/shop/overview');
  await page.route('**/api/shop/overview', route => route.fulfill({ json: { ...realOverview,
    installations: realOverview.installations.map(item => ({ ...item, providerId: 'synthetic-shop' })),
    exports: [{ id: 'mobile-export', installationId: realOverview.installations[0].id, productName: mobileProduct.name, packages: 2, createdAt: new Date().toISOString() }],
    receipts: [{ id: 'mobile-receipt', purchasedAt: new Date().toISOString(), storeLabel: 'Demo shop', status: 'processed', totalCents: 199,
      lines: [{ id: 'mobile-line', description: mobileProduct.name, quantity: 2, unit: 'unit', amountCents: 199, status: 'review', reviewReason: 'mapping_unconfirmed', links: [] }] }],
    review: [{ id: 'mobile-review', description: mobileProduct.name, quantity: 2, unit: 'unit', amountCents: 199, reviewReason: 'mapping_missing' }],
  } }));
  async function assertNoPageOverflow(label) {
    const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, `${label}: page overflow ${JSON.stringify(dimensions)}`);
  }
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${baseUrl}/shopping`, { waitUntil: 'networkidle' });
    for (const tab of ['Overview', 'Products', 'Receipts', 'Review']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await assertNoPageOverflow(`${width}px ${tab}`);
      if (width === 390) await page.screenshot({ path: `/tmp/gms-shop-${tab.toLowerCase()}-mobile.png`, fullPage: true });
    }
    await page.getByRole('tab', { name: 'Products', exact: true }).click();
    const rows = page.getByTestId('retailer-product');
    await rows.first().waitFor();
    assert.ok((await rows.first().textContent()).includes('Aubergine'), 'products are sorted alphabetically');
    await chooseOption('Product mapping filter', 'Available to map (1)');
    assert.equal(await rows.count(), 1);
    assert.ok((await rows.first().textContent()).includes('Aubergine'));
    await chooseOption('Product mapping filter', 'Mapped (1)');
    assert.equal(await rows.count(), 1);
    await page.getByLabel('Filter retailer products').fill('no-such-product');
    await page.getByText('No products match these filters.').waitFor();
    assert.equal(await rows.count(), 0);
    await page.getByLabel('Filter retailer products').fill('Cherry tomaten');
    const row = rows.first();
    await row.waitFor();
    assert.equal(await row.evaluate(node => getComputedStyle(node).display), width < 768 ? 'block' : 'table-row');
    if (width === 390 || width === 1280) await page.screenshot({ path: `/tmp/gms-shop-products-${width}.png`, fullPage: true });
    await row.getByRole('button', { name: 'Change', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.getByLabel('Role', { exact: true }).textContent(), 'Remembered alternative', 'editing preserves the current role');
    assert.equal(await page.getByLabel('Target', { exact: true }).inputValue(), 'Grocy: Cherry tomaten (Doos)', 'editing preserves the current target');
    await chooseOption('Target', 'Grocy: Cherry tomaten (Doos)');
    await assertNoPageOverflow(`${width}px mapping editor`);
    if (width === 390) await page.screenshot({ path: '/tmp/gms-shop-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  // Retain the saved Mealie unit label while units load, then reject deleted units.
  mealieMode = true;
  let releaseUnits;
  unitResponseGate = new Promise(resolve => { releaseUnits = resolve; });
  let savedMappings = 0;
  await page.route('**/api/shop/mappings', route => {
    savedMappings++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Products', exact: true }).click();
  await page.getByTestId('retailer-product').filter({ hasText: 'Cherry tomaten' }).getByRole('button', { name: 'Change', exact: true }).click();
  assert.equal(await page.getByLabel('Mealie unit', { exact: true }).inputValue(), 'Doos', 'saved unit remains visible while units are loading');
  const unitResponse = page.waitForResponse(response => response.url().includes('/api/shop/targets?'));
  releaseUnits();
  unitResponseGate = null;
  await unitResponse;
  await page.getByRole('button', { name: 'Save mapping', exact: true }).click();
  await page.getByText('This Mealie unit is no longer available; choose another unit', { exact: true }).waitFor();
  assert.equal(savedMappings, 0, 'deleted unit cannot be submitted');
  await chooseOption('Mealie unit', 'Count (no unit)');
  await page.getByRole('button', { name: 'Save mapping', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(savedMappings, 1, 'explicit no-unit choice can be saved');
  await page.unroute('**/api/shop/mappings');
  mealieMode = false;
  // Reuse the Mapping pager and reset it when filters narrow the result set.
  extraProducts = Array.from({ length: 60 }, (_, index) => ({ ...mobileProduct, externalId: `extra-${index}`, name: `Available product ${String(index).padStart(2, '0')}` }));
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('tab', { name: 'Products', exact: true }).click();
  await page.getByLabel('Filter retailer products').fill('');
  await chooseOption('Product mapping filter', 'All products (62)');
  await chooseOption('retailer products per page', '25');
  await page.getByText('Showing 1-25 of 62 retailer products').waitFor();
  assert.equal(await page.getByTestId('retailer-product').count(), 25);
  await chooseOption('retailer products per page', '50');
  await page.getByText('Showing 1-50 of 62 retailer products').waitFor();
  assert.equal(await page.getByTestId('retailer-product').count(), 50);
  await page.getByRole('button', { name: 'Next page of retailer products' }).click();
  await page.getByText('Showing 51-62 of 62 retailer products').waitFor();
  assert.equal(await page.getByTestId('retailer-product').count(), 12);
  await page.getByLabel('Filter retailer products').fill('Cherry tomaten');
  await page.getByText('Showing 1-1 of 1 retailer products').waitFor();
  await page.setViewportSize({ width: 360, height: 900 });
  await page.getByTestId('retailer-product').getByLabel('Amount per package').fill('1');
  await page.getByTestId('retailer-product').getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByText('confirmed', { exact: true }).waitFor();
  assert.equal(confirmedAmount, 1);
  await page.getByRole('button', { name: 'Use for list', exact: true }).click();
  await page.getByText('Preferred for list sync', { exact: true }).waitFor();
  assert.equal(mobileRole, 'preferred', 'changing role keeps the confirmed package amount');
  assert.equal(confirmedAmount, 1);
  await page.setViewportSize({ width: 1280, height: 1000 });
  extraSuggestions = Array.from({ length: 7 }, (_, index) => ({ id: `proposal-${index}`, retailerProductId: '456', targetKind: 'grocy_product', targetId: String(index), targetName: `Suggested ingredient ${index}`, score: 0.9 }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Products', exact: true }).click();
  await page.getByRole('button', { name: 'Show 2 more suggestions' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Accept', exact: true }).count(), 5);
  await page.getByRole('button', { name: 'Show 2 more suggestions' }).click();
  assert.equal(await page.getByRole('button', { name: 'Accept', exact: true }).count(), 7);
  await page.getByRole('button', { name: 'Show fewer suggestions' }).click();
  assert.equal(await page.getByRole('button', { name: 'Accept', exact: true }).count(), 5);
  // Popups use theme colors rather than the browser's native select palette.
  assert.equal(await page.locator('select').count(), 0, 'Shop choices do not use native select popups');
  assert.equal(await page.getByRole('combobox', { name: 'Product mapping filter' }).evaluate(node => node.tagName), 'BUTTON', 'short choice lists do not focus a text input');
  let lightPopupColor;
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      document.documentElement.setAttribute('data-theme', theme);
    }, theme);
    await page.getByRole('combobox', { name: 'Product mapping filter' }).click();
    const popupColor = await page.getByRole('listbox').evaluate(node => getComputedStyle(node.parentElement).backgroundColor);
    assert.notEqual(popupColor, 'rgba(0, 0, 0, 0)', `${theme}: popup has a themed background`);
    if (theme === 'light') lightPopupColor = popupColor;
    else assert.notEqual(popupColor, lightPopupColor, 'popup background changes with dark mode');
    await page.screenshot({ path: `/tmp/gms-shop-combobox-${theme}.png`, fullPage: true });
    await page.keyboard.press('Escape');
  }
  await page.screenshot({ path: '/tmp/gms-shop-suggestions-desktop.png', fullPage: true });
  await page.unroute('**/api/shop/mappings/mobile-mapping');
  await page.unroute('**/api/shop/targets?*');
  await page.unroute('**/api/shop/overview');
  await page.unroute('**/api/shop/mappings?*');

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
  console.log('Shop UI: plugin setup, mobile dialogs, responsive tabs, filters, sorting, pagination, suggestions and mapping actions passed.');
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
