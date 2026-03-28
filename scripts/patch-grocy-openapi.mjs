import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function patchGrocyOpenApi(specPath) {
  const document = JSON.parse(await readFile(specPath, 'utf8'));

  document.components ??= {};
  document.components.schemas ??= {};

  if (document.info?.description && typeof document.info.description === 'string') {
    document.info.description = document.info.description.replace(
      /\[here\]\(https?:\/\/[^)]+\/manageapikeys\)/,
      '[here](PlaceHolderManageApiKeysUrl)',
    );
  }

  if (Array.isArray(document.servers) && document.servers[0]?.url) {
    document.servers[0].url = 'xxx';
  }

  const schemas = document.components.schemas;
  let addedSchemaCount = 0;

  function fixRefs(value) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        fixRefs(entry);
      }
      return;
    }

    if (!value || typeof value !== 'object') {
      return;
    }

    if (typeof value.$ref === 'string' && value.$ref.startsWith('#/components/schemas/')) {
      const refName = value.$ref.split('/').pop();
      if (refName && !schemas[refName]) {
        schemas[refName] = { type: 'string' };
        addedSchemaCount += 1;
      }
    }

    for (const nestedValue of Object.values(value)) {
      fixRefs(nestedValue);
    }
  }

  fixRefs(document);

  await writeFile(specPath, `${JSON.stringify(document, null, 2)}\n`);

  return { addedSchemaCount };
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const specPath = resolve(process.cwd(), process.argv[2] ?? 'docs/grocy.openapi.json');
  const { addedSchemaCount } = await patchGrocyOpenApi(specPath);
  console.log(`Patched ${addedSchemaCount} missing Grocy schema refs in ${specPath}`);
}
