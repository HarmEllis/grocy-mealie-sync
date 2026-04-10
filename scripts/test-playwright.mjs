import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [
  'test-history-search.mjs',
  'test-mapping-wizard-refresh.mjs',
  'test-mapped-products-mobile.mjs',
  'test-settings-dark-selects.mjs',
];

async function runTest(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  console.log(`\n--- Running ${scriptName} ---`);

  const child = spawn(process.execPath, [scriptPath], {
    stdio: 'inherit',
  });

  const [exitCode] = await once(child, 'exit');
  return exitCode;
}

let failed = 0;

for (const test of tests) {
  const exitCode = await runTest(test);
  if (exitCode !== 0) {
    console.error(`FAILED: ${test} (exit code ${exitCode})`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${tests.length} Playwright test(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${tests.length} Playwright tests passed.`);
