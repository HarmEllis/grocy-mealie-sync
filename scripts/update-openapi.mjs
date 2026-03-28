import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { patchGeneratedOpenApiClient } from './patch-generated-openapi-clients.mjs';
import { patchGrocyOpenApi } from './patch-grocy-openapi.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const composePath = resolve(repoRoot, 'compose-dev.yml');
const grocySpecPath = resolve(repoRoot, 'docs', 'grocy.openapi.json');
const mealieSpecPath = resolve(repoRoot, 'docs', 'mealie.openapi.json');
const grocyClientDir = resolve(repoRoot, 'src', 'lib', 'grocy', 'client');
const mealieClientDir = resolve(repoRoot, 'src', 'lib', 'mealie', 'client');
const openApiCliPath = resolve(repoRoot, 'node_modules', 'openapi-typescript-codegen', 'bin', 'index.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? 'inherit',
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${details}`);
  }
}

function createBaseUrlCandidates(port, configuredUrl) {
  const candidates = [
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `http://host.docker.internal:${port}`,
    `http://host-docker-internal:${port}`,
  ];

  if (configuredUrl) {
    candidates.push(configuredUrl);
  }

  return [...new Set(candidates.map((value) => value.replace(/\/$/, '')))];
}

function buildUrl(baseUrl, pathName) {
  const url = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  url.pathname = `${basePath}${pathName}`;
  return url.toString();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function waitForService(name, baseUrls, pathName, headers) {
  const deadline = Date.now() + 240_000;
  let lastError = 'not started yet';

  while (Date.now() < deadline) {
    for (const baseUrl of baseUrls) {
      const url = buildUrl(baseUrl, pathName);

      try {
        await fetchJson(url, { headers });
        return baseUrl;
      } catch (error) {
        lastError = `${url}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
  }

  throw new Error(`Timed out waiting for ${name}. Last error: ${lastError}`);
}

async function writeJsonFile(filePath, value, spacing = 0) {
  const suffix = spacing > 0 ? '\n' : '';
  await writeFile(filePath, `${JSON.stringify(value, null, spacing)}${suffix}`);
}

if (!process.env.GROCY_API_KEY) {
  throw new Error('GROCY_API_KEY is required in .env to download the Grocy OpenAPI spec.');
}

if (!existsSync(openApiCliPath)) {
  throw new Error('openapi-typescript-codegen is not installed. Run `npm install` first.');
}

const grocyHeaders = {
  'GROCY-API-KEY': process.env.GROCY_API_KEY,
};

const mealieHeaders = process.env.MEALIE_API_TOKEN
  ? { Authorization: `Bearer ${process.env.MEALIE_API_TOKEN}` }
  : {};

run('docker', ['compose', '-f', composePath, 'up', '-d', '--pull', 'always', 'postgres', 'mealie', 'grocy']);

const grocyBaseUrl = await waitForService(
  'Grocy',
  createBaseUrlCandidates(9001, process.env.GROCY_URL),
  '/api/openapi/specification',
  grocyHeaders,
);

const mealieBaseUrl = await waitForService(
  'Mealie',
  createBaseUrlCandidates(9000, process.env.MEALIE_URL),
  '/openapi.json',
  mealieHeaders,
);

const grocySpec = await fetchJson(buildUrl(grocyBaseUrl, '/api/openapi/specification'), {
  headers: grocyHeaders,
});
const mealieSpec = await fetchJson(buildUrl(mealieBaseUrl, '/openapi.json'), {
  headers: mealieHeaders,
});

await writeJsonFile(grocySpecPath, grocySpec, 2);
const { addedSchemaCount } = await patchGrocyOpenApi(grocySpecPath);
await writeJsonFile(mealieSpecPath, mealieSpec);

await rm(grocyClientDir, { recursive: true, force: true });
await rm(mealieClientDir, { recursive: true, force: true });

run(process.execPath, [
  openApiCliPath,
  '--input',
  grocySpecPath,
  '--output',
  grocyClientDir,
  '--client',
  'fetch',
]);

run(process.execPath, [
  openApiCliPath,
  '--input',
  mealieSpecPath,
  '--output',
  mealieClientDir,
  '--client',
  'fetch',
]);

await patchGeneratedOpenApiClient(grocyClientDir);
await patchGeneratedOpenApiClient(mealieClientDir);

console.log(`Grocy OpenAPI refreshed from ${grocyBaseUrl} (${grocySpec.info?.version ?? 'unknown version'})`);
console.log(`Mealie OpenAPI refreshed from ${mealieBaseUrl} (${mealieSpec.info?.version ?? 'unknown version'})`);
console.log(`Patched ${addedSchemaCount} missing Grocy schema refs`);
console.log(`Regenerated clients in ${join('src', 'lib', 'grocy', 'client')} and ${join('src', 'lib', 'mealie', 'client')}`);
