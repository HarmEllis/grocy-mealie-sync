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

  // Product-first mapping: one canonical row, one column per provider, editable
  // alternatives and explicitly confirmed quantities. Fixtures never contact shops.
  const realOverview = await (await fetch(`${baseUrl}/api/shop/overview`)).json();
  const original = realOverview.installations[0];
  const installations = [
    { ...original, providerId: 'ah', providerLabel: 'Albert Heijn', connected: true, listReplacementBlocks: [{ retailerProductId: '123', blockingRetailerProductId: 'previous', blockingProductName: 'Previous cherry tomatoes', blockingKind: 'note', blockingReason: null }], features: ['list.notes'], manualNoteProductIds: [], settings: { ...original.settings, boundAccountKey: 'synthetic-account' } },
    { ...original, id: 'ah-second', providerId: 'ah', providerLabel: 'Albert Heijn', connected: false },
    { ...original, id: 'picnic', name: 'Picnic', providerId: 'picnic', providerLabel: 'Picnic', connected: false },
  ];
  const targets = [
    { kind: 'grocy_product', id: '79', name: 'Cherry tomaten', source: 'grocy_mealie', linkedFoods: [{ id: 'food1', name: 'Tomaten' }], baseUnitId: '11', baseUnitName: 'Doos' },
    { kind: 'grocy_product', id: '80', name: 'Aubergine', source: 'grocy', linkedFoods: [], baseUnitId: '11', baseUnitName: 'Doos' },
    { kind: 'mealie_food', id: 'food2', name: 'Kipfilet', source: 'mealie', linkedFoods: [], baseUnitId: null, baseUnitName: null },
    ...Array.from({ length: 60 }, (_, index) => ({ kind: 'grocy_product', id: `extra-${index}`, name: `Product ${String(index).padStart(2, '0')}`, source: 'grocy', linkedFoods: [], baseUnitId: '11', baseUnitName: 'Doos' })),
  ];
  const products = [
    { providerId: 'ah', externalId: '123', name: 'AH Cherry tomatoes with a deliberately long product name', packageAmount: 250, packageUnit: 'g', measure: 'unit', availability: 'available' },
    { providerId: 'ah', externalId: '456', name: 'AH Alternative cherry tomatoes', packageAmount: 500, packageUnit: 'g', measure: 'unit', availability: 'temporarily_unavailable' },
    { providerId: 'ah', externalId: 'old', name: 'Discontinued tomatoes', packageAmount: 250, packageUnit: 'g', measure: 'unit', availability: 'discontinued' },
  ];
  const mappings = [{ id: 'mapping1', providerId: 'ah', retailerProductId: '123', retailerProductName: products[0].name, targetKind: 'grocy_product', targetId: '79', targetName: 'Cherry tomaten', role: 'preferred', packageBaseUnitId: '11', packageBaseUnitName: 'Doos', packageBaseAmount: null, confirmed: false }];
  let catalogCalls = 0;
  let savedBody;
  let suggestions = [{ id: 'suggestion1', providerId: 'ah', retailerProductId: '456', targetKind: 'grocy_product', targetId: '79', targetName: 'Cherry tomaten', score: 0.9 }];
  const searches = [{ id: 'search1', targetName: 'Cherry tomaten', status: 'complete', resultCount: 2, lastError: null }];
  await page.route('**/api/shop/overview', route => route.fulfill({ json: { ...realOverview, installations,
    exports: [{ id: 'e1', installationId: original.id, productName: products[0].name, packages: 2, createdAt: new Date().toISOString() }],
    receipts: [{ id: 'r1', providerId: 'ah', referenceOnly: true, purchasedAt: new Date().toISOString(), storeLabel: 'Demo', status: 'reference_only', totalCents: 199, lines: [{ id: 'line1', description: products[0].name, retailerProductId: '123', quantity: 2, unit: 'unit', amountCents: 199, status: 'reference_only', links: [] }] }],
    review: [],
  } }));
  await page.route('**/api/shop/products?*', route => {
    const params = new URL(route.request().url()).searchParams;
    const query = params.get('query')?.toLowerCase() ?? '';
    const source = params.get('source');
    const mapped = params.get('mapped');
    const offset = Number(params.get('offset') ?? 0);
    const limit = Number(params.get('limit') ?? 50);
    const filtered = targets.filter(target => (!source || source === 'all' || target.source === source)
      && (mapped === 'all' || !mapped || (target.id === '79') === (mapped === 'mapped'))
      && `${target.name} ${target.linkedFoods.map(food => food.name).join(' ')}`.toLowerCase().includes(query));
    return route.fulfill({ json: { targets: filtered.slice(offset, offset + limit), total: filtered.length, offset,
      counts: { all: 63, grocy_mealie: 1, grocy: 61, mealie: 1, mapped: 1, unmapped: 62 }, mealieUnits: [{ id: 'g', name: 'gram' }],
    } });
  });
  await page.route('**/api/shop/mappings', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { mappings, products, suggestions, searches } });
    savedBody = route.request().postDataJSON();
    const index = mappings.findIndex(mapping => mapping.retailerProductId === savedBody.retailerProductId);
    const row = { id: index < 0 ? `mapping${mappings.length + 1}` : mappings[index].id, ...savedBody, retailerProductName: products.find(product => product.externalId === savedBody.retailerProductId)?.name ?? savedBody.retailerProductId,
      packageBaseUnitId: savedBody.baseUnitId, packageBaseUnitName: savedBody.baseUnitName, confirmed: savedBody.confirm };
    if (index < 0) mappings.push(row); else mappings[index] = row;
    return route.fulfill({ json: { mapping: row } });
  });
  await page.route('**/api/shop/mappings/*', route => {
    const id = route.request().url().split('/').at(-1);
    const mapping = mappings.find(mapping => mapping.id === id);
    if (route.request().method() === 'DELETE') mappings.splice(mappings.indexOf(mapping), 1);
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      if (body.role === 'preferred') for (const item of mappings) item.role = item.id === id ? 'preferred' : 'alternative';
    }
    return route.fulfill({ json: { mapping } });
  });
  await page.route('**/api/shop/mappings?*', route => route.fulfill({ json: { mappings, products, suggestions, searches } }));
  await page.route('**/api/shop/mappings/preview', route => route.fulfill({ json: { baseUnitId: '11', baseUnitName: 'Doos', derivation: { amount: 2, explanation: '1 package = 2 Doos' }, linkedFoods: [], conversions: [], demandConversions: [], requiresConfirmation: true, measure: 'unit' } }));
  await page.route('**/api/plugins/installations/*/catalog?*', route => {
    catalogCalls++;
    return route.fulfill({ json: { products: products.map(product => ({ ...product, id: product.externalId })) } });
  });
  await page.route('**/api/shop/lists/fallback', route => {
    const body = route.request().postDataJSON();
    const installation = installations.find(item => item.id === body.installationId);
    installation.manualNoteProductIds = body.mode === 'note' ? [...(installation.manualNoteProductIds ?? []), body.retailerProductId] : (installation.manualNoteProductIds ?? []).filter(id => id !== body.retailerProductId);
    return route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/shop/targets?*', route => route.fulfill({ json: { targets: targets.slice(0, 3), mealieUnits: [{ id: 'g', name: 'gram' }] } }));
  await page.route('**/api/shop/suggestions/*', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/shop/searches/*/retry', route => route.fulfill({ json: { ok: true } }));

  async function chooseOption(label, option) {
    await page.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  }
  async function assertNoPageOverflow(label) {
    const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, `${label}: page overflow ${JSON.stringify(dimensions)}`);
  }
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${baseUrl}/shopping`, { waitUntil: 'networkidle', timeout: 180_000 });
    for (const tab of ['Overview', 'Products', 'Receipts', 'Review']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await assertNoPageOverflow(`${width}px ${tab}`);
      if (tab === 'Receipts') {
        await page.getByRole('button', { name: 'Map product', exact: true }).click();
        await page.getByRole('dialog').waitFor();
        await page.getByLabel('Target', { exact: true }).click();
        assert.equal(await page.getByLabel('Target', { exact: true }).inputValue(), '', 'receipt target search starts empty on opening');
        await page.keyboard.press('Escape');
        await assertNoPageOverflow(`${width}px receipt mapping`);
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
    }
    await page.getByRole('tab', { name: 'Products', exact: true }).click();
    await page.getByTestId('shop-own-product').first().waitFor();
    assert.ok((await page.getByTestId('shop-own-product').first().textContent()).includes('Cherry tomaten'), 'linked rows sort first');
    const beforeOpen = catalogCalls;
    await page.getByLabel('Search own products').fill('Cherry');
    await page.getByText('Showing 1-1 of 1 own products').waitFor();
    assert.equal(catalogCalls, beforeOpen, 'closed mapping rows never fetch retailer catalogues');
    const row = page.getByTestId('shop-own-product').first();
    await row.getByText('Waiting for Previous cherry tomatoes to leave the list', { exact: false }).waitFor();
    assert.equal(await row.getByRole('combobox').count(), 2, 'multiple AH installations share one provider column');
    assert.equal(await row.evaluate(node => getComputedStyle(node).display), width < 768 ? 'block' : 'table-row');
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Unit & amount', exact: true }).first().click();
    await page.getByRole('button', { name: 'Use suggested amount', exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').getByLabel('Amount per package').inputValue(), mappings[0].packageBaseAmount?.toString() ?? '', 'opening preserves confirmation state');
    await page.getByRole('button', { name: 'Use suggested amount', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm mapping', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm mapping', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(savedBody.packageBaseAmount, 2);
    assert.equal(savedBody.baseUnitId, '11');
    assert.equal(savedBody.confirm, true);
    await assertNoPageOverflow(`${width}px own-product editor`);
    if (width === 390) await page.screenshot({ path: '/tmp/gms-shop-own-products-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await chooseOption('Product source', '(M) Mealie only (1)');
    await page.getByText('No products match these filters.').waitFor();
    await page.getByLabel('Search own products').fill('');
    await page.getByText('Showing 1-1 of 1 own products').waitFor();
    assert.ok((await page.getByTestId('shop-own-product').first().textContent()).includes('Kipfilet'));
    await chooseOption('Product source', 'All (63)');
  }
  // Add a replacement as a remembered alternative, never another preferred list line.
  await page.getByLabel('Search own products').fill('Cherry');
  await page.getByText('Showing 1-1 of 1 own products').waitFor();
  await page.getByTestId('shop-own-product').filter({ hasText: 'Cherry tomaten' }).getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Add alternative', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  const picker = dialog.getByRole('combobox', { name: 'Albert Heijn product for Cherry tomaten', exact: true }).last();
  await picker.click();
  await page.getByRole('option', { name: 'AH Alternative cherry tomatoes · 500 g · temporarily out of stock', exact: true }).waitFor();
  assert.equal(await page.getByRole('option', { name: /Discontinued tomatoes/ }).count(), 0, 'discontinued products are never selectable');
  await picker.fill('Alternative');
  await page.getByRole('option', { name: 'AH Alternative cherry tomatoes · 500 g · temporarily out of stock', exact: true }).click();
  await dialog.getByLabel('Amount per package').fill('1');
  await dialog.getByRole('button', { name: 'Confirm mapping', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm mapping', exact: true }).waitFor({ state: 'hidden' });
  assert.equal(savedBody.role, 'alternative');
  assert.equal(mappings[0].role, 'preferred');
  await dialog.getByRole('button', { name: 'Use as preferred', exact: true }).click();
  assert.equal(mappings.find(mapping => mapping.retailerProductId === '456').role, 'preferred');
  assert.equal(mappings.find(mapping => mapping.retailerProductId === '456').packageBaseAmount, 1);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByLabel('Search own products').fill('');
  await chooseOption('own products per page', '25');
  await page.getByText('Showing 1-25 of 63 own products').waitFor();
  assert.equal(await page.getByTestId('shop-own-product').count(), 25);
  await page.getByRole('button', { name: 'Next page of own products' }).click();
  await page.getByText('Showing 26-50 of 63 own products').waitFor();
  await page.getByLabel('Search own products').fill('Cherry');
  await page.getByText('Showing 1-1 of 1 own products').waitFor();
  await chooseOption('Mapping status', 'Not yet mapped');
  await page.getByText('No products match these filters.').waitFor();
  await chooseOption('Mapping status', 'Mapped');
  await page.getByText('Showing 1-1 of 1 own products').waitFor();
  for (const name of ['Search again', 'Reject']) {
    const button = page.getByRole('button', { name, exact: true });
    const gap = await button.evaluate(node => node.parentElement.getBoundingClientRect().right - node.getBoundingClientRect().right);
    assert.ok(gap <= 17, `${name} stays right aligned`);
  }
  assert.equal(await page.locator('select').count(), 0, 'Shop controls use themed popups');
  let lightColor;
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => {
      document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(theme);
      document.documentElement.setAttribute('data-theme', theme);
    }, theme);
    await page.getByRole('combobox', { name: 'Mapping status' }).click();
    const color = await page.getByRole('listbox').evaluate(node => getComputedStyle(node.parentElement).backgroundColor);
    assert.notEqual(color, 'rgba(0, 0, 0, 0)');
    if (theme === 'light') lightColor = color; else assert.notEqual(color, lightColor);
    await page.keyboard.press('Escape');
  }
  await page.screenshot({ path: '/tmp/gms-shop-own-products-desktop.png', fullPage: true });
  // Offline choices retain known products and clearly explain the absent live search.
  const offlinePicker = page.getByTestId('shop-own-product').getByRole('combobox', { name: 'Picnic product for Cherry tomaten' });
  await offlinePicker.click();
  await page.getByText('Plugin offline · known products only').waitFor();
  await page.keyboard.press('Escape');

  // A legacy direct-Mealie mapping remains visible in its linked canonical row.
  // Moving it to Grocy requires a new amount, rather than reusing a Mealie amount.
  const legacy = mappings.find(mapping => mapping.role === 'preferred');
  legacy.targetKind = 'mealie_food'; legacy.targetId = 'food1';
  legacy.packageBaseUnitId = 'g'; legacy.packageBaseUnitName = 'gram'; legacy.packageBaseAmount = 500;
  await page.getByRole('button', { name: 'Refresh', exact: true }).last().click();
  await page.getByText('Unit changed; reconfirm', { exact: true }).waitFor();
  await page.getByTestId('shop-own-product').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Unit & amount', exact: true }).first().click();
  await page.getByText('This was mapped directly to the linked Mealie ingredient.', { exact: false }).waitFor();
  assert.equal(await page.getByLabel('Amount per package').inputValue(), '', 'legacy unit amounts are not silently reused');
  await page.getByLabel('Amount per package').fill('1.5');
  await page.getByRole('button', { name: 'Confirm mapping', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm mapping', exact: true }).waitFor({ state: 'hidden' });
  assert.equal(savedBody.targetKind, 'grocy_product');
  assert.equal(savedBody.targetId, '79');
  assert.equal(savedBody.baseUnitId, '11');
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  // The explicit escape only changes this account's representation, not mapping units.
  await page.getByTestId('shop-own-product').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Use text item', exact: true }).first().click();
  await page.getByRole('button', { name: 'Use preferred product', exact: true }).waitFor();
  assert.deepEqual(installations[0].manualNoteProductIds, [savedBody.retailerProductId]);
  assert.equal(mappings.find(mapping => mapping.role === 'preferred').packageBaseAmount, 1.5);
  await page.getByRole('button', { name: 'Use preferred product', exact: true }).click();
  await page.getByRole('button', { name: 'Use text item', exact: true }).first().waitFor();
  assert.deepEqual(installations[0].manualNoteProductIds, []);
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  // Revoke from Settings.
  await page.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.getByTestId('plugin-installation').filter({ hasText: 'Demo shop' }).getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByText('No shop plugins yet.').waitFor({ timeout: 30_000 });

  assert.deepEqual(pageErrors, [], 'no client-side errors');
  console.log('Shop UI: plugin setup, canonical product mappings, mobile dialogs, alternatives, units, provider columns, offline search, dark mode and pagination passed.');
} catch (error) {
  console.error(error);
  if (browser) { const pages = browser.contexts().flatMap(context => context.pages()); for (const page of pages) console.error((await page.locator('body').innerText()).slice(0, 4000)); }
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
