import { describe, it, expect } from 'vitest';
import { validateDatabasePath } from '../index';

describe('validateDatabasePath', () => {
  it('accepts valid path under ./data', () => {
    expect(() => validateDatabasePath('./data/sync.db')).not.toThrow();
  });

  it('accepts path equal to the ./data directory', () => {
    expect(() => validateDatabasePath('./data')).not.toThrow();
  });

  it('accepts path under /app/data (Docker path)', () => {
    expect(() => validateDatabasePath('/app/data/sync.db')).not.toThrow();
  });

  it('rejects path traversal', () => {
    expect(() => validateDatabasePath('./data/../etc/passwd')).toThrow(/security restriction/);
  });

  it('rejects sibling directory with shared prefix', () => {
    expect(() => validateDatabasePath('./data-evil/sync.db')).toThrow(/security restriction/);
  });

  it('rejects absolute path outside allowed dirs', () => {
    expect(() => validateDatabasePath('/tmp/sync.db')).toThrow(/security restriction/);
  });

  it('rejects relative path outside allowed dirs', () => {
    expect(() => validateDatabasePath('../sync.db')).toThrow(/security restriction/);
  });
});
