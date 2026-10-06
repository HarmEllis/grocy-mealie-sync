import { createHash, randomUUID } from 'crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { receiptCursors, receiptLines, receipts } from '../db/schema';
import type { PluginInstallation } from '../plugins/installations';
import type { Receipt, ReceiptSummary } from '../plugins/protocol/v1';
import { getLedgerActivatedAt } from './ledger';
import { rememberReceiptProduct } from './retailer-catalog';

/**
 * Receipt levels, kept strictly apart:
 * 1. a plugin hint (`receipts.available`, optional),
 * 2. a durable pull driven by core (catch-up on connect, periodic, on hint, on demand),
 * 3. a stored receipt,
 * 4. planned ledger effects,
 * 5. applied effects.
 * The plugin keeps no acknowledgement state; storing a receipt never means it was booked.
 */

export type ReceiptStatus = 'ignored_before_activation' | 'stored' | 'planned' | 'processed' | 'needs_review' | 'changed';
export type ReceiptRow = typeof receipts.$inferSelect;
export type ReceiptLineRow = typeof receiptLines.$inferSelect;

/** Re-read window so receipts that show up late at the retailer are still found. */
export const RECEIPT_PULL_OVERLAP_MS = 2 * 24 * 60 * 60 * 1000;
export const RECEIPT_PULL_INTERVAL_MS = 30 * 60 * 1000;
const MAX_PAGES_PER_PULL = 50;

export interface ReceiptPullDeps {
  listReceipts: (params: { since: string; cursor?: string }) => Promise<{ receipts: ReceiptSummary[]; nextCursor?: string | null }>;
  getReceipt: (receiptId: string) => Promise<Receipt>;
  now: () => Date;
}

export interface ReceiptPullResult {
  status: 'ok' | 'skipped' | 'error';
  listed: number;
  stored: number;
  ignored: number;
  changed: number;
  message?: string;
}

export function receiptContentHash(receipt: Receipt): string {
  const lines = [...receipt.lines].sort((a, b) => a.lineNo - b.lineNo);
  return createHash('sha256').update(JSON.stringify([receipt.purchasedAt, lines])).digest('hex');
}

function cursorId(installationId: string, accountKey: string): string {
  return `${installationId}:${accountKey}`;
}

export function getReceiptCursor(installationId: string, accountKey: string) {
  return db.select().from(receiptCursors).where(eq(receiptCursors.id, cursorId(installationId, accountKey))).get() ?? null;
}

export function isReceiptPullDue(installation: PluginInstallation, now: Date): boolean {
  if (!installation.accountKey) return false;
  const cursor = getReceiptCursor(installation.id, installation.accountKey);
  if (cursor?.pageCursor) return true;
  return !cursor?.lastPullAt || now.getTime() - cursor.lastPullAt.getTime() >= RECEIPT_PULL_INTERVAL_MS;
}

function activationBoundary(installation: PluginInstallation): Date | null {
  const activated = installation.settings.receiptsActivatedAt ? new Date(installation.settings.receiptsActivatedAt) : null;
  const ledger = getLedgerActivatedAt();
  if (!activated) return null;
  return ledger && ledger > activated ? ledger : activated;
}

function storeReceipt(installation: PluginInstallation, accountKey: string, receipt: Receipt, boundary: Date, now: Date): 'stored' | 'ignored' | 'duplicate' {
  const purchasedAt = new Date(receipt.purchasedAt);
  const ignored = purchasedAt.getTime() < boundary.getTime();
  let duplicate = false;
  db.transaction((tx) => {
    const id = randomUUID();
    const inserted = tx.insert(receipts).values({
      id,
      installationId: installation.id,
      providerId: installation.providerId ?? 'unknown',
      accountKey,
      externalReceiptId: receipt.receiptId,
      purchasedAt,
      fetchedAt: now,
      contentHash: receiptContentHash(receipt),
      status: ignored ? 'ignored_before_activation' : 'stored',
      lineCount: receipt.lines.length,
      storeLabel: receipt.storeLabel ?? null,
      totalCents: receipt.totalCents ?? null,
    }).onConflictDoNothing().run();
    if (inserted.changes === 0) {
      // Another installation of the same retailer account already stored it.
      duplicate = true;
      return;
    }
    // Receipts before the activation boundary are kept as headers only.
    if (ignored) return;
    for (const line of receipt.lines) {
      tx.insert(receiptLines).values({
        id: randomUUID(),
        receiptId: id,
        lineNo: line.lineNo,
        kind: line.kind,
        retailerProductId: line.retailerProductId ?? null,
        gtin: line.gtin ?? null,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPriceCents: line.unitPriceCents ?? null,
        amountCents: line.amountCents ?? null,
        status: line.kind === 'product' ? 'pending' : 'ignored',
        reviewReason: null,
      }).run();
    }
  });
  if (duplicate) return 'duplicate';
  if (!ignored && installation.providerId) {
    for (const line of receipt.lines) {
      if (line.kind === 'product' && line.retailerProductId) {
        rememberReceiptProduct(installation.providerId, line.retailerProductId, line.description, /kg|gram|^g$/i.test(line.unit) ? 'weight' : 'unit', now);
      }
    }
  }
  return ignored ? 'ignored' : 'stored';
}

/**
 * Pull receipts from the persisted cursor with an overlap window. Safe to run
 * repeatedly: receipts are deduplicated per retailer account. Receipts inside
 * the overlap window are always re-fetched and compared by content hash, since
 * retailers can change a receipt without changing its header. The high-water
 * mark only advances once every page was read; an unfinished pull resumes from
 * its page cursor.
 */
export async function pullReceipts(installation: PluginInstallation, deps: ReceiptPullDeps): Promise<ReceiptPullResult> {
  const result: ReceiptPullResult = { status: 'ok', listed: 0, stored: 0, ignored: 0, changed: 0 };
  const accountKey = installation.accountKey;
  const boundary = activationBoundary(installation);
  if (!installation.settings.receiptsEnabled || !boundary) return { ...result, status: 'skipped', message: 'Receipt processing is disabled' };
  if (!accountKey) return { ...result, status: 'skipped', message: 'The plugin is not signed in to a retailer account' };
  if (installation.settings.boundAccountKey && installation.settings.boundAccountKey !== accountKey) {
    return { ...result, status: 'skipped', message: 'The plugin is signed in to a different retailer account' };
  }
  const providerId = installation.providerId ?? 'unknown';

  const now = deps.now();
  const id = cursorId(installation.id, accountKey);
  const cursor = getReceiptCursor(installation.id, accountKey);
  const sinceBase = cursor?.sinceAt ?? boundary;
  const since = new Date(Math.max(sinceBase.getTime(), boundary.getTime()) - RECEIPT_PULL_OVERLAP_MS);
  let newestPurchase = cursor?.sinceAt ?? null;
  let pageCursor: string | undefined = cursor?.pageCursor ?? undefined;
  const saveCursor = (values: { sinceAt?: Date | null; pageCursor: string | null; lastError: string | null }) => {
    const row = { lastPullAt: now, ...values };
    db.insert(receiptCursors)
      .values({ id, installationId: installation.id, accountKey, sinceAt: values.sinceAt ?? cursor?.sinceAt ?? null, ...row })
      .onConflictDoUpdate({ target: receiptCursors.id, set: row })
      .run();
  };

  try {
    for (let page = 0; page < MAX_PAGES_PER_PULL; page++) {
      const response = await deps.listReceipts({ since: since.toISOString(), ...(pageCursor ? { cursor: pageCursor } : {}) });
      for (const summary of response.receipts) {
        result.listed++;
        const purchasedAt = new Date(summary.purchasedAt);
        if (!newestPurchase || purchasedAt > newestPurchase) newestPurchase = purchasedAt;
        const existing = db.select().from(receipts).where(and(
          eq(receipts.providerId, providerId),
          eq(receipts.accountKey, accountKey),
          eq(receipts.externalReceiptId, summary.receiptId),
        )).get();
        if (existing) {
          if (existing.status === 'ignored_before_activation' || existing.status === 'changed') continue;
          // No upstream revision exists, so always compare the full content.
          const fresh = await deps.getReceipt(summary.receiptId);
          if (receiptContentHash(fresh) !== existing.contentHash) {
            // A receipt that changed after we stored it is never re-booked automatically.
            db.update(receipts).set({ status: 'changed' }).where(eq(receipts.id, existing.id)).run();
            result.changed++;
          }
          continue;
        }
        const receipt = await deps.getReceipt(summary.receiptId);
        const stored = storeReceipt(installation, accountKey, receipt, boundary, now);
        if (stored === 'stored') result.stored++;
        else if (stored === 'ignored') result.ignored++;
      }
      pageCursor = response.nextCursor ?? undefined;
      if (!pageCursor) break;
      // Persist progress per page so an interruption resumes instead of restarting.
      saveCursor({ pageCursor, lastError: null });
    }
    if (pageCursor) {
      saveCursor({ pageCursor, lastError: null });
      return { ...result, message: 'More receipts remain; the next pull continues where this one stopped' };
    }
    saveCursor({ sinceAt: newestPurchase, pageCursor: null, lastError: null });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    saveCursor({ pageCursor: pageCursor ?? null, lastError: message.slice(0, 500) });
    return { ...result, status: 'error', message };
  }
}

export function listReceipts(filter: { statuses?: ReceiptStatus[]; installationId?: string; limit?: number } = {}): ReceiptRow[] {
  const rows = filter.statuses?.length
    ? db.select().from(receipts).where(inArray(receipts.status, filter.statuses)).orderBy(asc(receipts.purchasedAt)).all()
    : db.select().from(receipts).orderBy(asc(receipts.purchasedAt)).all();
  const filtered = filter.installationId ? rows.filter(row => row.installationId === filter.installationId) : rows;
  return filter.limit ? filtered.slice(-filter.limit) : filtered;
}

export function getReceipt(id: string): ReceiptRow | null {
  return db.select().from(receipts).where(eq(receipts.id, id)).get() ?? null;
}

export function getReceiptLines(receiptId: string): ReceiptLineRow[] {
  return db.select().from(receiptLines).where(eq(receiptLines.receiptId, receiptId)).orderBy(asc(receiptLines.lineNo)).all();
}

export function getReceiptLine(id: string): ReceiptLineRow | null {
  return db.select().from(receiptLines).where(eq(receiptLines.id, id)).get() ?? null;
}

export function setReceiptStatus(id: string, status: ReceiptStatus, now = new Date()): void {
  db.update(receipts).set({ status, ...(status === 'processed' ? { processedAt: now } : {}) }).where(eq(receipts.id, id)).run();
}
