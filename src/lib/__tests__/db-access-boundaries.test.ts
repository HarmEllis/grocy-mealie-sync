import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('db access boundaries', () => {
  it('keeps history storage on the Drizzle side of the db layer', () => {
    const source = readSource('lib/history-store.ts');

    expect(source).not.toMatch(/import\s*\{\s*sqlite\s*\}\s*from\s*['"]\.\/db['"]/);
    expect(source).not.toContain('sqlite.');
  });

  it('keeps mapping conflict storage on the Drizzle side of the db layer', () => {
    const source = readSource('lib/mapping-conflicts-store.ts');

    expect(source).not.toMatch(/import\s*\{\s*sqlite\s*\}\s*from\s*['"]\.\/db['"]/);
    expect(source).not.toContain('sqlite.');
  });

  it('keeps sync mutex storage on the Drizzle side of the db layer', () => {
    const source = readSource('lib/sync/mutex.ts');

    expect(source).not.toMatch(/import\s*\{\s*sqlite\s*\}\s*from\s*['"]\.\.\/db['"]/);
    expect(source).not.toContain('sqlite.');
  });
});
