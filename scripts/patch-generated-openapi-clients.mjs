import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function patchOpenApiConfig(content, filePath) {
  let nextContent = content;

  if (!nextContent.includes('ALLOW_INSECURE_TLS?: boolean;')) {
    const marker = "    ENCODE_PATH?: ((path: string) => string) | undefined;\n";
    if (!nextContent.includes(marker)) {
      throw new Error(`Could not find ENCODE_PATH marker in ${filePath}`);
    }

    nextContent = nextContent.replace(
      marker,
      `${marker}    ALLOW_INSECURE_TLS?: boolean;\n`,
    );
  }

  if (!nextContent.includes('ALLOW_INSECURE_TLS: false,')) {
    const marker = '    ENCODE_PATH: undefined,\n';
    if (!nextContent.includes(marker)) {
      throw new Error(`Could not find ENCODE_PATH default in ${filePath}`);
    }

    nextContent = nextContent.replace(
      marker,
      `${marker}    ALLOW_INSECURE_TLS: false,\n`,
    );
  }

  return nextContent;
}

function patchRequestFile(content, filePath) {
  let nextContent = content;

  if (!nextContent.includes("import { buildServerFetchInit } from '../../../server-fetch';")) {
    const marker = "import type { OpenAPIConfig } from './OpenAPI';\n";
    if (!nextContent.includes(marker)) {
      throw new Error(`Could not find OpenAPIConfig import in ${filePath}`);
    }

    nextContent = nextContent.replace(
      marker,
      `${marker}import { buildServerFetchInit } from '../../../server-fetch';\n`,
    );
  }

  if (!nextContent.includes('const request = buildServerFetchInit({')) {
    const originalBlock = `    const request: RequestInit = {\n        headers,\n        body: body ?? formData,\n        method: options.method,\n        signal: controller.signal,\n    };\n`;
    if (!nextContent.includes(originalBlock)) {
      throw new Error(`Could not find request block in ${filePath}`);
    }

    const replacementBlock = `    const request = buildServerFetchInit({\n        headers,\n        body: body ?? formData,\n        method: options.method,\n        signal: controller.signal,\n    }, config.ALLOW_INSECURE_TLS === true);\n`;

    nextContent = nextContent.replace(originalBlock, replacementBlock);
  }

  return nextContent;
}

function patchBlankEnumMembers(content) {
  const lines = content.split('\n');
  let emptyMemberCount = 0;
  let changed = false;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)= ''(,?)$/);
    if (!match) {
      continue;
    }

    emptyMemberCount += 1;
    const memberName = emptyMemberCount === 1 ? 'EMPTY' : `EMPTY_${emptyMemberCount}`;
    lines[index] = `${match[1]}${memberName} = ''${match[2]}`;
    changed = true;
  }

  return changed ? lines.join('\n') : content;
}

function patchMealieOrderDirectionModel(content) {
  if (!content.includes('export enum OrderDirection')) {
    return content;
  }

  return `/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OrderDirection = 'asc' | 'desc';
`;
}

export async function patchGeneratedOpenApiClient(clientDir) {
  const openApiPath = join(clientDir, 'core', 'OpenAPI.ts');
  const requestPath = join(clientDir, 'core', 'request.ts');
  const indexPath = join(clientDir, 'index.ts');
  const modelsDir = join(clientDir, 'models');

  const openApiContent = await readFile(openApiPath, 'utf8');
  const patchedOpenApi = patchOpenApiConfig(openApiContent, openApiPath);
  if (patchedOpenApi !== openApiContent) {
    await writeFile(openApiPath, patchedOpenApi);
  }

  const requestContent = await readFile(requestPath, 'utf8');
  const patchedRequest = patchRequestFile(requestContent, requestPath);
  if (patchedRequest !== requestContent) {
    await writeFile(requestPath, patchedRequest);
  }

  const modelEntries = await readdir(modelsDir, { withFileTypes: true });
  for (const entry of modelEntries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) {
      continue;
    }

    const modelPath = join(modelsDir, entry.name);
    const modelContent = await readFile(modelPath, 'utf8');
    const patchedModel = patchBlankEnumMembers(modelContent);
    const patchedCompatibilityModel = entry.name === 'OrderDirection.ts'
      ? patchMealieOrderDirectionModel(patchedModel)
      : patchedModel;

    if (patchedCompatibilityModel !== modelContent) {
      await writeFile(modelPath, patchedCompatibilityModel);
    }
  }

  const indexContent = await readFile(indexPath, 'utf8');
  const patchedIndex = indexContent.replace(
    "export { OrderDirection } from './models/OrderDirection';",
    "export type { OrderDirection } from './models/OrderDirection';",
  );
  if (patchedIndex !== indexContent) {
    await writeFile(indexPath, patchedIndex);
  }
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const clientDirs = process.argv.slice(2);
  if (clientDirs.length === 0) {
    throw new Error('Pass at least one generated client directory to patch.');
  }

  for (const clientDir of clientDirs) {
    await patchGeneratedOpenApiClient(resolve(process.cwd(), clientDir));
    console.log(`Patched generated client at ${clientDir}`);
  }
}
