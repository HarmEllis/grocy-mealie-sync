import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { AdapterError } from '../lib/errors.ts';
import {
  FEATURES, helloParamsSchema, pluginMethods, receiptSchema, shopListSchema,
  type HelloParams, type ListApplyParams, type ListOpResult, type PluginMethod, type Receipt, type RetailerProduct,
} from '../lib/protocol/v1.ts';
import type { ShopAdapter } from '../lib/client.ts';

export const catalogue: RetailerProduct[] = [
  { id: 'demo-milk', name: 'Demo milk', brand: 'Synthetic', packageAmount: 1, packageUnit: 'l', measure: 'unit', availability: 'available' },
  { id: 'demo-rice', name: 'Demo rice', brand: 'Synthetic', packageAmount: 500, packageUnit: 'g', measure: 'unit', availability: 'temporarily_unavailable' },
  { id: 'demo-apples', name: 'Demo apples', brand: 'Synthetic', packageUnit: 'kg', measure: 'weight' },
  // Retailers only report `discontinued` when they say so explicitly; it still answers catalog.get.
  { id: 'demo-old-yoghurt', name: 'Demo old yoghurt', brand: 'Synthetic', packageAmount: 500, packageUnit: 'g', measure: 'unit', availability: 'discontinued' },
];

/** Notes are identified by text; compare them like most retailers do. */
export function sameNoteText(a: string, b: string): boolean {
  const normalize = (text: string) => text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(a) === normalize(b);
}
const stateSchema = z.object({
  authenticated: z.boolean(), accountKey: z.string().nullable(), boundAccountKey: z.string().nullable(),
  list: shopListSchema,
});
type State = z.infer<typeof stateSchema>;

/** Synthetic retailer. Replace only this adapter when starting a real shop plugin. */
export class DemoAdapter implements ShopAdapter {
  private readonly dataDir: string;
  private state: State;
  private authStepId: string | null = null;
  private mutationTail: Promise<unknown> = Promise.resolve();
  constructor(dataDir: string, initiallyAuthenticated = false) {
    this.dataDir = dataDir;
    this.state = { authenticated: initiallyAuthenticated, accountKey: initiallyAuthenticated ? 'demo-account-default' : null,
      boundAccountKey: initiallyAuthenticated ? 'demo-account-default' : null, list: { listId: 'demo-list', lines: [] } };
  }
  async init(): Promise<this> {
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    try { this.state = stateSchema.parse(JSON.parse(await readFile(join(this.dataDir, 'state.json'), 'utf8'))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new AdapterError('INTERNAL', 'Cannot load demo state.'); }
    await this.persist(this.state);
    return this;
  }
  private async persist(state: State): Promise<void> {
    const temporary = join(this.dataDir, `state.${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await rename(temporary, join(this.dataDir, 'state.json'));
    this.state = state;
  }
  getManifest(): HelloParams {
    return helloParamsSchema.parse({ pluginName: 'Demo shop', pluginVersion: '0.1.0', providerId: 'demo-shop', providerLabel: 'Demo shop',
      accountKey: this.state.accountKey, accountLabel: this.state.accountKey ? 'Synthetic demo account' : null,
      protocolVersions: [1], capabilities: ['auth', 'catalog', 'list', 'receipts'], features: [FEATURES.listNotes],
      authState: this.state.authenticated ? 'authenticated' : 'unauthenticated' });
  }
  private async receipts(): Promise<Receipt[]> {
    try { return z.array(receiptSchema).parse(JSON.parse(await readFile(join(this.dataDir, 'receipts.json'), 'utf8'))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new AdapterError('UPSTREAM_CHANGED', 'Demo receipt fixtures are invalid.');
    }
  }
  private async apply(params: ListApplyParams) {
    if (params.listId !== this.state.list.listId) throw new AdapterError('NOT_FOUND', 'Unknown list.');
    const next = structuredClone(this.state);
    const results: ListOpResult[] = [];
    params.ops.forEach((operation, index) => {
      if (operation.op === 'add_note') {
        if (next.list.lines.some(line => line.retailerProductId === null && sameNoteText(line.description, operation.text))) {
          // An identical note may be someone else's; never adopt it.
          results.push({ index, status: 'conflict', reason: 'note_exists', message: 'A note with this text exists.' }); return;
        }
        const lineId = `note-${randomUUID()}`;
        next.list.lines.push({ lineId, retailerProductId: null, description: operation.text, quantity: 1 });
        results.push({ index, status: 'applied', lineId }); return;
      }
      if (operation.op === 'remove_note') {
        const note = next.list.lines.find(candidate => candidate.lineId === operation.lineId);
        if (!note || note.retailerProductId !== null || !sameNoteText(note.description, operation.expectedText)) {
          results.push({ index, status: 'conflict', message: 'The note changed.' }); return;
        }
        next.list.lines = next.list.lines.filter(candidate => candidate !== note);
        results.push({ index, status: 'applied', lineId: note.lineId }); return;
      }
      if (operation.op === 'add') {
        const product = catalogue.find(candidate => candidate.id === operation.retailerProductId);
        if (!product) {
          results.push({ index, status: 'failed', message: 'Unknown product.' }); return;
        }
        if (product.availability === 'discontinued') {
          results.push({ index, status: 'failed', reason: 'product_discontinued', message: 'This product is no longer sold.' }); return;
        }
        if (next.list.lines.some(line => line.retailerProductId === operation.retailerProductId)) {
          results.push({ index, status: 'conflict', message: 'Product already exists.' }); return;
        }
        const lineId = randomUUID();
        next.list.lines.push({ lineId, retailerProductId: operation.retailerProductId, quantity: operation.quantity,
          description: catalogue.find(product => product.id === operation.retailerProductId)!.name });
        results.push({ index, status: 'applied', lineId }); return;
      }
      const line = next.list.lines.find(candidate => candidate.lineId === operation.lineId);
      if (!line || line.quantity !== operation.expectedQuantity) { results.push({ index, status: 'conflict', message: 'Quantity changed.' }); return; }
      if (operation.op === 'remove') next.list.lines = next.list.lines.filter(candidate => candidate.lineId !== line.lineId);
      else line.quantity = operation.quantity;
      results.push({ index, status: 'applied', lineId: line.lineId });
    });
    try { await this.persist(next); }
    catch { throw new AdapterError('INTERNAL', 'Cannot confirm the list write.', 'unknown'); }
    return { opId: params.opId, results, list: structuredClone(next.list) };
  }
  handle(method: PluginMethod, raw: unknown): Promise<unknown> {
    const execute = () => this.dispatch(method, raw);
    if (!method.startsWith('auth.') && method !== 'list.apply') return execute();
    const next = this.mutationTail.then(execute, execute);
    this.mutationTail = next.catch(() => {});
    return next;
  }
  private async dispatch(method: PluginMethod, raw: unknown): Promise<unknown> {
    if (method === 'auth.begin') {
      this.authStepId = randomUUID();
      return { stepId: this.authStepId, kind: 'form', title: 'Connect the synthetic shop',
        message: 'Use any stable account label and the synthetic code demo. No real credentials are needed.',
        fields: [{ name: 'account', label: 'Stable account label', type: 'text', required: true, secret: false },
          { name: 'code', label: 'Synthetic code (demo)', type: 'code', required: true, secret: true }] };
    }
    if (method === 'auth.submit') {
      const params = pluginMethods[method].params.parse(raw);
      if (params.stepId !== this.authStepId || params.values.code !== 'demo' || !params.values.account?.trim()) {
        throw new AdapterError('UNAUTHENTICATED', 'Use the current step and synthetic code demo.');
      }
      const accountKey = createHash('sha256').update(`demo-shop:${params.values.account.trim().toLowerCase()}`).digest('hex');
      if (this.state.boundAccountKey && this.state.boundAccountKey !== accountKey) throw new AdapterError('CONFLICT', 'Use a new volume and installation for another account.');
      await this.persist({ ...this.state, authenticated: true, accountKey, boundAccountKey: accountKey });
      this.authStepId = null;
      return { stepId: params.stepId, kind: 'done', title: 'Synthetic account connected' };
    }
    if (method === 'auth.logout') {
      await this.persist({ ...this.state, authenticated: false, accountKey: null });
      this.authStepId = null;
      return { stepId: randomUUID(), kind: 'done', title: 'Synthetic account disconnected' };
    }
    if (!this.state.authenticated) throw new AdapterError('UNAUTHENTICATED', 'Connect the synthetic account first.');
    switch (method) {
      case 'catalog.search': {
        const { query } = pluginMethods[method].params.parse(raw);
        return { products: catalogue.filter(product => product.name.toLowerCase().includes(query.toLowerCase())) };
      }
      case 'catalog.get': {
        const { ids } = pluginMethods[method].params.parse(raw);
        return { products: catalogue.filter(product => ids.includes(product.id)) };
      }
      case 'list.read': return structuredClone(this.state.list);
      case 'list.apply': return this.apply(pluginMethods[method].params.parse(raw));
      case 'receipts.list': {
        const { since } = pluginMethods[method].params.parse(raw);
        return { receipts: (await this.receipts()).filter(receipt => Date.parse(receipt.purchasedAt) >= Date.parse(since))
          .map(receipt => ({ receiptId: receipt.receiptId, purchasedAt: receipt.purchasedAt, lineCount: receipt.lines.length })), nextCursor: null };
      }
      case 'receipts.get': {
        const { receiptId } = pluginMethods[method].params.parse(raw);
        const receipt = (await this.receipts()).find(candidate => candidate.receiptId === receiptId);
        if (!receipt) throw new AdapterError('NOT_FOUND', 'Unknown synthetic receipt.');
        return receipt;
      }
    }
  }
}
