import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { chromium } from 'playwright';
import { getConversionLibrary } from '../src/lib/conversions/catalog.ts';

const catalog = getConversionLibrary();
const port = await new Promise((resolve, reject) => {
  const server = net.createServer(); server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close(() => resolve(address.port)); });
});
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
  detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, AUTH_ENABLED: 'false', GROCY_URL: 'http://127.0.0.1:1', GROCY_API_KEY: 'test-only', MEALIE_URL: 'http://127.0.0.1:1', MEALIE_API_TOKEN: 'test-only', DATABASE_PATH: './data/conversions-playwright.db', HISTORY_RETENTION_DAYS: '-1' },
});
let serverLog = '';
server.stdout.on('data', data => { serverLog += data; }); server.stderr.on('data', data => { serverLog += data; });
let browser;
try {
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${serverLog}`);
    try { const response = await fetch(`${baseUrl}/conversions`, { signal: AbortSignal.timeout(2500) }); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Server did not start: ${serverLog}`);
  browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let imported = false, conflict = false, lastImport = null, staleImport = true;
  const units = { counts: { grocyUnits: 4, mealieUnits: 4, mappedUnits: 2 },
    grocyUnits: ['gram', 'kilogram', 'milliliter', 'liter'].map((id, i) => ({ id: i + 1, name: catalog.entries.flatMap(e => [e.from, e.to]).find(u => u.id === id).name, mappingId: null, pluralName: null, pluralForms: [] })),
    mealieUnits: ['gram', 'kilogram', 'milliliter', 'liter'].map((id, i) => ({ id: `m-${i + 1}`, name: catalog.entries.flatMap(e => [e.from, e.to]).find(u => u.id === id).name, mappingId: null, abbreviation: '', aliases: [], pluralName: null, pluralAbbreviation: null })) };
  function preview(body) {
    const entries = catalog.entries.filter(e => body.entryIds.includes(e.id));
    const required = [...new Map(entries.flatMap(e => [[e.from.id, e.from], [e.to.id, e.to]])).values()];
    const plans = required.map(unit => {
      const grocy = units.grocyUnits.find(u => u.name === unit.name) ?? null;
      const mealie = body.target === 'grocy' ? null : units.mealieUnits.find(u => u.name === unit.name) ?? null;
      return { unit, mealie, grocy, mealieCandidates: mealie ? [mealie] : [], grocyCandidates: grocy ? [grocy] : [], createMealie: body.target !== 'grocy' && !mealie, createGrocy: !grocy, standardizeMealie: body.target !== 'grocy' && !imported && unit.id === 'kilogram', createMapping: false, name: unit.name, pluralName: unit.pluralName, problems: [] };
    });
    return { version: '1', selection: { target: 'both', createMissingUnits: true, bindings: {}, ...body }, fingerprint: 'a'.repeat(64), units: plans,
      entries: entries.map(entry => ({ entry, status: conflict && entry.from.id === 'kilogram' ? 'conflict' : imported && entry.from.id === 'kilogram' ? 'already_available' : 'ready', message: conflict ? 'An existing Grocy conversion has a different factor.' : 'Ready.', ...(conflict ? { existingFactor: 500 } : {}) })),
      canImport: !conflict, counts: { units: plans.reduce((n, u) => n + Number(u.createMealie) + Number(u.createGrocy), 0), standardizations: plans.filter(u => u.standardizeMealie).length, mappings: 0, conversions: entries.filter(e => !imported || e.from.id !== 'kilogram').length, available: imported ? 1 : 0, blocked: conflict ? 1 : 0 } };
  }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = {};
    if (path === '/api/status') data = { lastGrocyPoll: null, lastMealiePoll: null, schedulerStatus: 'inactive' };
    else if (path === '/api/conversions/preview') data = preview(route.request().postDataJSON());
    else if (path === '/api/conversions/import') {
      lastImport = route.request().postDataJSON();
      if (staleImport) {
        staleImport = false;
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'PREVIEW_STALE', error: 'Your units changed. Review the updated preview.', preview: { ...preview(lastImport), fingerprint: 'b'.repeat(64) } }) });
        return;
      }
      imported = true;
      data = { status: 'success', created: 2, failed: 0, steps: [
        { system: 'Mealie', kind: 'standardization', unitId: 'kilogram', name: 'Kilogram', id: 'm-2', status: 'updated', message: 'Set Kilogram to 1000 gram in Mealie.' },
        { system: 'Grocy', kind: 'conversion', unitId: 'kilogram', name: '1 kilogram = 1000 g', id: 1, status: 'created', message: 'Added 1 kilogram = 1000 g in Grocy.' },
      ] };
    } else if (path === '/api/conversions') data = { units, products: [{ id: 1, name: 'Milk' }], conversions: imported ? [
      { id: 1, fromUnitId: 2, fromUnitName: 'Kilogram', toUnitId: 1, toUnitName: 'Gram', factor: 1000, grocyProductId: null },
      { id: 2, fromUnitId: 1, fromUnitName: 'Gram', toUnitId: 2, toUnitName: 'Kilogram', factor: 0.001, grocyProductId: null },
    ] : [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.addInitScript(() => localStorage.setItem('gms:theme', 'dark'));
  await page.goto(`${baseUrl}/conversions`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Units & conversions', exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/gms-conversions-desktop.png', fullPage: true });
  await page.getByRole('checkbox', { name: 'Select Kilogram', exact: true }).click();
  await page.getByRole('button', { name: 'Review import', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Apply 2 changes', exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/gms-conversions-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Apply 2 changes', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Your units changed' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Refresh preview', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Apply 2 changes', exact: true }).click();
  await page.getByRole('heading', { name: 'Your units are set up' }).waitFor();
  assert.equal(lastImport.target, 'both'); assert.equal(lastImport.fingerprint, 'b'.repeat(64)); assert.deepEqual(lastImport.entryIds, ['kilogram-to-gram']);
  await page.getByRole('tab', { name: /Installed/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Delete Kilogram to Gram' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Delete Gram to Kilogram' }).count(), 0);
  await page.getByRole('tab', { name: /Library/ }).click();
  await page.getByRole('checkbox', { name: 'Select Kilogram', exact: true }).click(); conflict = true;
  await page.getByRole('button', { name: 'Review import', exact: true }).click();
  await page.getByText('Factor conflict', { exact: true }).last().waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Resolve highlighted items', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/gms-conversions-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Mobile page must not overflow horizontally.');
  await page.getByRole('button', { name: 'Review import', exact: true }).click();
  await page.getByRole('dialog').evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))); });
  const box = await page.getByRole('dialog').boundingBox(); assert.ok(box.width <= 390);
  await page.screenshot({ path: '/tmp/gms-conversions-mobile-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.addInitScript(() => localStorage.setItem('gms:theme', 'light'));
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual(errors, [], 'The browser must have no client errors.');
  console.log('Conversions: preview, shared import, conflict blocking, inverse grouping, mobile layout and light/dark rendering passed.');
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null && server.pid) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    await new Promise(resolve => { server.once('exit', resolve); setTimeout(resolve, 5000); });
    if (server.exitCode === null) { try { process.kill(-server.pid, 'SIGKILL'); } catch {} }
  }
}
