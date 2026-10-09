import { createHash } from 'crypto';
import { and, asc, eq, lte, ne } from 'drizzle-orm';
import { db } from '../db';
import { shopCatalogSearches } from '../db/schema';
import type { RetailerProduct } from '../plugins/protocol/v1';
import type { ProjectionDemand } from './projection';
import type { UnitContext } from './units';
import { generateSuggestions, listRetailerMappings, upsertRetailerProducts, type SuggestionCandidate } from './retailer-catalog';

/** Queue each unmapped ingredient once per retailer and name, surviving restarts. */
export function queueCatalogDiscovery(providerId: string, demands: ProjectionDemand[], ctx: UnitContext, now = new Date()): number {
  const preferred = new Set(listRetailerMappings(providerId).filter(m => m.role === 'preferred').map(m => `${m.targetKind}:${m.targetId}`));
  const targets = new Map<string, SuggestionCandidate>();
  for (const demand of demands) {
    if (demand.subItems?.length) {
      for (const child of demand.subItems) {
        const parentId = demand.foodId ? ctx.foodToGrocyProduct.get(demand.foodId) : undefined;
        const parent = parentId === undefined ? undefined : ctx.grocyProducts.get(parentId);
        const product = ctx.grocyProducts.get(child.grocyProductId);
        if (parent && product && parent.quIdStock !== null && parent.quIdStock === product.quIdStock
          && preferred.has(`grocy_product:${parentId}`)) continue;
        targets.set(`grocy_product:${child.grocyProductId}`, { targetKind: 'grocy_product', targetId: String(child.grocyProductId), targetName: product?.name ?? child.name });
      }
    } else if (demand.foodId) {
      const grocyId = ctx.foodToGrocyProduct.get(demand.foodId);
      if (preferred.has(`mealie_food:${demand.foodId}`) || (grocyId !== undefined && preferred.has(`grocy_product:${grocyId}`))) continue;
      const target: SuggestionCandidate = grocyId !== undefined
        ? { targetKind: 'grocy_product', targetId: String(grocyId), targetName: ctx.grocyProducts.get(grocyId)?.name ?? demand.label }
        : { targetKind: 'mealie_food', targetId: demand.foodId, targetName: demand.label };
      targets.set(`${target.targetKind}:${target.targetId}`, target);
    }
  }
  let added = 0;
  db.transaction(tx => {
    tx.update(shopCatalogSearches).set({ active: false }).where(eq(shopCatalogSearches.providerId, providerId)).run();
    for (const [key, target] of targets) {
      if (preferred.has(key)) continue;
      const query = target.targetName.trim().slice(0, 200);
      if (!query) continue;
      const id = createHash('sha256').update(JSON.stringify([providerId, key, query.toLowerCase()])).digest('hex');
      const current = tx.select().from(shopCatalogSearches).where(eq(shopCatalogSearches.id, id)).get();
      if (!current) added++;
      tx.insert(shopCatalogSearches).values({ id, providerId, ...target, query, nextAttemptAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: shopCatalogSearches.id, set: { active: true } }).run();
    }
  });
  return added;
}

export function listCatalogSearches(providerId?: string) {
  const rows = db.select().from(shopCatalogSearches).where(eq(shopCatalogSearches.active, true)).orderBy(asc(shopCatalogSearches.updatedAt)).all();
  return providerId ? rows.filter(row => row.providerId === providerId) : rows;
}

export function retryCatalogSearch(id: string): boolean {
  return db.update(shopCatalogSearches).set({ status: 'pending', attempts: 0, lastError: null, nextAttemptAt: new Date() })
    .where(and(eq(shopCatalogSearches.id, id), eq(shopCatalogSearches.active, true))).run().changes > 0;
}

/** Called by the plugin I/O worker, outside the main synchronization lock. */
export async function discoverCatalogProducts(providerId: string, search: (query: string) => Promise<RetailerProduct[]>, now = new Date(), limit = 3) {
  const queued = db.select().from(shopCatalogSearches).where(and(
    eq(shopCatalogSearches.providerId, providerId), eq(shopCatalogSearches.active, true),
    ne(shopCatalogSearches.status, 'complete'), lte(shopCatalogSearches.nextAttemptAt, now),
  )).orderBy(asc(shopCatalogSearches.nextAttemptAt)).limit(limit).all();
  const outcomes: Array<{ targetName: string; products: number; error?: string }> = [];
  for (const row of queued) {
    if (!db.select().from(shopCatalogSearches).where(eq(shopCatalogSearches.id, row.id)).get()?.active) continue;
    // Mappings can be confirmed while a queued request waits for the worker.
    if (listRetailerMappings(providerId).some(m => m.role === 'preferred' && m.targetKind === row.targetKind && m.targetId === row.targetId)) {
      db.update(shopCatalogSearches).set({ active: false }).where(eq(shopCatalogSearches.id, row.id)).run();
      continue;
    }
    try {
      const products = await search(row.query);
      const current = db.select().from(shopCatalogSearches).where(eq(shopCatalogSearches.id, row.id)).get();
      if (!current?.active) continue;
      upsertRetailerProducts(providerId, products, now);
      generateSuggestions(providerId, [{ targetKind: row.targetKind as SuggestionCandidate['targetKind'], targetId: row.targetId, targetName: row.targetName }], { now });
      db.update(shopCatalogSearches).set({ status: 'complete', attempts: row.attempts + 1, resultCount: products.length, lastError: null, updatedAt: now })
        .where(eq(shopCatalogSearches.id, row.id)).run();
      outcomes.push({ targetName: row.targetName, products: products.length });
    } catch {
      // Third-party exceptions may contain tokens or response bodies. Persist only a safe explanation.
      const error = 'Catalogue search failed. Check the plugin connection and retailer sign-in, then retry.';
      const delay = Math.min(60 * 60_000, 60_000 * 2 ** Math.min(row.attempts, 6));
      db.update(shopCatalogSearches).set({ status: 'error', attempts: row.attempts + 1, lastError: error, nextAttemptAt: new Date(now.getTime() + delay), updatedAt: now })
        .where(eq(shopCatalogSearches.id, row.id)).run();
      outcomes.push({ targetName: row.targetName, products: 0, error });
    }
  }
  return outcomes;
}
