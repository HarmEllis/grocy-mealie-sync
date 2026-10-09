import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public plugin template', () => {
  it('vendors the exact core wire protocol', () => {
    const core = readFileSync(new URL('../protocol/v1.ts', import.meta.url), 'utf8');
    const template = readFileSync(new URL('../../../../examples/shop-plugin-template/lib/protocol/v1.ts', import.meta.url), 'utf8');
    expect(template).toBe(core);
  });
});
