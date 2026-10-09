import { readFile, writeFile } from 'node:fs/promises';
const source = new URL('../src/lib/plugins/protocol/v1.ts', import.meta.url);
const destination = new URL('../examples/shop-plugin-template/lib/protocol/v1.ts', import.meta.url);
const content = await readFile(source, 'utf8');
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== content) throw new Error('Plugin protocol copies differ. Run npm run plugins:sync-protocol.');
  console.log('Plugin protocol copies match.');
} else {
  await writeFile(destination, content);
  console.log('Updated the template protocol from core.');
}
