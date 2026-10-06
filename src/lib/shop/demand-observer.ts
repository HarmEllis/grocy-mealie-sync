import { createHash, randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { demandRevisions, demands } from '../db/schema';
import type { MealieShoppingItem } from '../mealie/types';
import { GMS_ITEMS_KEY, isValidSubProductItem, type SubProductItem } from '../shopping-notes';

/**
 * Records how Mealie shopping rows evolve so exports, receipts and manual
 * checks can be attributed to a concrete demand revision. A removed row means
 * the demand was cancelled; it never implies a purchase. A re-added row has a
 * new Mealie item ID and therefore is new demand.
 */

export type DemandStatus = 'open' | 'checked' | 'removed';

export interface DemandSnapshot {
  foodId: string | null;
  unitId: string | null;
  quantity: number;
  note: string | null;
  subItems: SubProductItem[] | null;
  checked: boolean;
}

export function parseSubItems(item: Pick<MealieShoppingItem, 'extras'>): SubProductItem[] | null {
  const raw = (item.extras as Record<string, unknown> | undefined)?.[GMS_ITEMS_KEY];
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return Array.isArray(value) && value.length > 0 && value.every(isValidSubProductItem) ? value as SubProductItem[] : null;
}

export function snapshotOf(item: MealieShoppingItem): DemandSnapshot {
  return {
    foodId: item.foodId ?? null,
    unitId: item.unitId ?? null,
    quantity: Number(item.quantity ?? 0),
    note: item.note ?? null,
    subItems: parseSubItems(item),
    checked: Boolean(item.checked),
  };
}

/** Identity of a row's demand without its quantity: food, unit and sub-products. */
export function identityOf(snapshot: Pick<DemandSnapshot, 'foodId' | 'unitId' | 'subItems'>): string {
  return createHash('sha256').update(JSON.stringify([snapshot.foodId, snapshot.unitId, snapshot.subItems])).digest('hex').slice(0, 32);
}

export function rowIdentityOf(item: MealieShoppingItem): string {
  return identityOf(snapshotOf(item));
}

/** Free-text notes are rewritten by sub-product sync, so they do not create revisions. */
export function fingerprintOf(snapshot: DemandSnapshot): string {
  return createHash('sha256').update(JSON.stringify([
    snapshot.foodId, snapshot.unitId, snapshot.quantity, snapshot.subItems, snapshot.checked,
  ])).digest('hex').slice(0, 32);
}

export interface DemandObservationSummary {
  created: number;
  revised: number;
  checked: number;
  reopened: number;
  removed: number;
}

export function observeDemand(shoppingListId: string, items: MealieShoppingItem[], now = new Date()): DemandObservationSummary {
  const summary: DemandObservationSummary = { created: 0, revised: 0, checked: 0, reopened: 0, removed: 0 };
  db.transaction((tx) => {
    const existingRows = tx.select().from(demands)
      .where(and(eq(demands.shoppingListId, shoppingListId), inArray(demands.status, ['open', 'checked'])))
      .all();
    const existingById = new Map(existingRows.map(row => [row.mealieItemId, row]));
    const seen = new Set<string>();

    for (const item of items) {
      seen.add(item.id);
      const snapshot = snapshotOf(item);
      const fingerprint = fingerprintOf(snapshot);
      let demand = existingById.get(item.id) ?? tx.select().from(demands).where(eq(demands.mealieItemId, item.id)).get();

      if (!demand) {
        const revisionId = randomUUID();
        tx.insert(demands).values({
          mealieItemId: item.id,
          shoppingListId,
          status: snapshot.checked ? 'checked' : 'open',
          latestRevisionId: revisionId,
          firstSeenAt: now,
          checkedAt: snapshot.checked ? now : null,
        }).run();
        insertRevision(tx, revisionId, item.id, 1, snapshot, fingerprint, now);
        summary.created++;
        continue;
      }

      if (demand.status === 'removed') {
        // The same item ID reappeared (for example after a Mealie restore); treat it as reopened demand.
        tx.update(demands).set({ status: snapshot.checked ? 'checked' : 'open', removedAt: null }).where(eq(demands.mealieItemId, item.id)).run();
        demand = { ...demand, status: snapshot.checked ? 'checked' : 'open', removedAt: null };
      }

      const latest = demand.latestRevisionId
        ? tx.select().from(demandRevisions).where(eq(demandRevisions.id, demand.latestRevisionId)).get()
        : undefined;
      if (!latest || latest.fingerprint !== fingerprint) {
        const revisionId = randomUUID();
        if (latest) {
          tx.update(demandRevisions).set({ supersededAt: now }).where(eq(demandRevisions.id, latest.id)).run();
        }
        insertRevision(tx, revisionId, item.id, (latest?.revision ?? 0) + 1, snapshot, fingerprint, now);
        tx.update(demands).set({ latestRevisionId: revisionId }).where(eq(demands.mealieItemId, item.id)).run();
        summary.revised += latest ? 1 : 0;
      }

      if (snapshot.checked && demand.status !== 'checked') {
        tx.update(demands).set({ status: 'checked', checkedAt: now }).where(eq(demands.mealieItemId, item.id)).run();
        summary.checked++;
      } else if (!snapshot.checked && demand.status === 'checked') {
        tx.update(demands).set({ status: 'open', checkedAt: null }).where(eq(demands.mealieItemId, item.id)).run();
        summary.reopened++;
      }
    }

    for (const row of existingRows) {
      if (seen.has(row.mealieItemId)) continue;
      // A checked row that disappears was cleaned up after the check; an open
      // row that disappears was cancelled. Either way nothing was bought here.
      tx.update(demands)
        .set({ status: row.status === 'checked' ? 'checked' : 'removed', removedAt: now })
        .where(eq(demands.mealieItemId, row.mealieItemId))
        .run();
      if (row.status === 'open') summary.removed++;
    }
  });
  return summary;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function insertRevision(tx: Tx, id: string, mealieItemId: string, revision: number, snapshot: DemandSnapshot, fingerprint: string, now: Date): void {
  tx.insert(demandRevisions).values({
    id,
    mealieItemId,
    revision,
    foodId: snapshot.foodId,
    unitId: snapshot.unitId,
    quantity: snapshot.quantity,
    note: snapshot.note,
    subItemsJson: snapshot.subItems ? JSON.stringify(snapshot.subItems) : null,
    checked: snapshot.checked,
    fingerprint,
    observedAt: now,
  }).run();
}

export type DemandRow = typeof demands.$inferSelect;
export type DemandRevisionRow = typeof demandRevisions.$inferSelect;

export function getDemand(mealieItemId: string): DemandRow | null {
  return db.select().from(demands).where(eq(demands.mealieItemId, mealieItemId)).get() ?? null;
}

export function getDemandRevision(id: string): DemandRevisionRow | null {
  return db.select().from(demandRevisions).where(eq(demandRevisions.id, id)).get() ?? null;
}

/** Open (unchecked, still listed) demand with its latest revision. */
export function listOpenDemand(shoppingListId?: string): Array<{ demand: DemandRow; revision: DemandRevisionRow }> {
  const rows = db.select().from(demands).where(eq(demands.status, 'open')).all()
    .filter(row => !row.removedAt && (!shoppingListId || row.shoppingListId === shoppingListId));
  const revisionIds = rows.map(row => row.latestRevisionId).filter((id): id is string => Boolean(id));
  if (revisionIds.length === 0) return [];
  const revisions = new Map(db.select().from(demandRevisions).where(inArray(demandRevisions.id, revisionIds)).all().map(row => [row.id, row]));
  return rows.flatMap((demand) => {
    const revision = demand.latestRevisionId ? revisions.get(demand.latestRevisionId) : undefined;
    return revision ? [{ demand, revision }] : [];
  });
}
