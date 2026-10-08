import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listApplyResultSchema, type ListApplyParams, type ListApplyResult } from './protocol/v1.ts';
import { AdapterError } from './errors.ts';

type Record = { digest: string; result?: ListApplyResult; error?: { code: AdapterError['code']; message: string } };

/**
 * Settles an interrupted operation from retailer evidence. Return a complete
 * result only when evidence safely settles every op without claiming uncertain
 * ownership (ops that were
 * never attempted may be reported as `failed`); return null to keep it unknown.
 */
export type Reconciler = (params: ListApplyParams) => Promise<ListApplyResult | null>;

function complete(result: ListApplyResult, params: ListApplyParams): boolean {
  return result.opId === params.opId && result.list.listId === params.listId && result.results.length === params.ops.length
    && new Set(result.results.map(item => item.index)).size === params.ops.length
    && result.results.every(item => item.index < params.ops.length);
}

/** Store intent before retailer writes. An interrupted operation never runs again without evidence. */
export class OperationCache {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly directory: string;
  constructor(directory: string) { this.directory = directory; }

  run(namespace: string, params: ListApplyParams, execute: () => Promise<unknown>, reconcile?: Reconciler): Promise<ListApplyResult> {
    const next = this.tail.then(() => this.apply(namespace, params, execute, reconcile));
    this.tail = next.catch(() => {});
    return next;
  }

  private async apply(namespace: string, params: ListApplyParams, execute: () => Promise<unknown>, reconcile?: Reconciler): Promise<ListApplyResult> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const filename = join(this.directory, `${createHash('sha256').update(`${namespace}:${params.opId}`).digest('hex')}.json`);
    const digest = createHash('sha256').update(JSON.stringify(params)).digest('hex');
    let previous: Record | undefined;
    try { previous = JSON.parse(await readFile(filename, 'utf8')) as Record; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new AdapterError('INTERNAL', 'Cannot read durable operation storage.', 'unknown'); }
    if (previous) {
      if (previous.digest !== digest) throw new AdapterError('CONFLICT', 'Operation ID reused with different contents.');
      if (previous.result) return listApplyResultSchema.parse(previous.result);
      if (previous.error) throw new AdapterError(previous.error.code, previous.error.message);
    }
    const persist = async (record: Record) => {
      const temporary = `${filename}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
      await rename(temporary, filename);
    };
    if (previous) {
      // Never execute again; only retailer evidence may settle the earlier attempt.
      let reconciled: ListApplyResult | null = null;
      try {
        const raw = reconcile ? await reconcile(params) : null;
        reconciled = raw ? listApplyResultSchema.parse(raw) : null;
      } catch {
        reconciled = null;
      }
      if (reconciled && complete(reconciled, params)) {
        await persist({ digest, result: reconciled });
        return reconciled;
      }
      throw new AdapterError('CONFLICT', 'An earlier operation has an uncertain outcome. Verify it before continuing.', 'unknown');
    }
    await persist({ digest });
    let result: ListApplyResult;
    try {
      result = listApplyResultSchema.parse(await execute());
      if (!complete(result, params)) {
        throw new AdapterError('UPSTREAM_CHANGED', 'Incomplete operation confirmation.', 'unknown');
      }
    } catch (error) {
      if (error instanceof AdapterError && error.outcome === 'not_applied') {
        await persist({ digest, error: { code: error.code, message: error.message } });
      }
      throw error;
    }
    await persist({ digest, result });
    return result;
  }
}
