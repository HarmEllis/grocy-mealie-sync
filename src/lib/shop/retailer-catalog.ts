import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { retailerMappings, retailerProducts, retailerSuggestions } from '../db/schema';
import { fuzzyMatch } from '../fuzzy-match';
import type { RetailerProduct } from '../plugins/protocol/v1';
import { derivePackageBaseAmount, type TargetKind } from './units';

export type RetailerProductRow = typeof retailerProducts.$inferSelect;
export type RetailerMappingRow = typeof retailerMappings.$inferSelect;
export type RetailerSuggestionRow = typeof retailerSuggestions.$inferSelect;
export type MappingRole = 'preferred' | 'alternative';

function productKey(providerId: string, externalId: string): string {
  return `${providerId}:${externalId}`;
}

export function upsertRetailerProducts(providerId: string, products: RetailerProduct[], now = new Date()): void {
  if (products.length === 0) return;
  db.transaction((tx) => {
    for (const product of products) {
      const values = {
        name: product.name,
        brand: product.brand ?? null,
        gtinsJson: product.gtins ? JSON.stringify(product.gtins) : null,
        packageAmount: product.packageAmount ?? null,
        packageUnit: product.packageUnit ?? null,
        measure: product.measure,
        lastSeenAt: now,
      };
      tx.insert(retailerProducts)
        .values({ id: productKey(providerId, product.id), providerId, externalId: product.id, ...values })
        .onConflictDoUpdate({ target: [retailerProducts.providerId, retailerProducts.externalId], set: values })
        .run();
    }
  });
}

/** Remember a product seen only on a receipt, without overwriting catalogue data. */
export function rememberReceiptProduct(providerId: string, externalId: string, description: string, measure: 'unit' | 'weight', now = new Date()): void {
  db.insert(retailerProducts).values({
    id: productKey(providerId, externalId),
    providerId,
    externalId,
    name: description || externalId,
    measure,
    lastSeenAt: now,
  }).onConflictDoNothing().run();
}

export function getRetailerProduct(providerId: string, externalId: string): RetailerProductRow | null {
  return db.select().from(retailerProducts)
    .where(and(eq(retailerProducts.providerId, providerId), eq(retailerProducts.externalId, externalId)))
    .get() ?? null;
}

export function listRetailerProducts(providerId?: string): RetailerProductRow[] {
  return providerId
    ? db.select().from(retailerProducts).where(eq(retailerProducts.providerId, providerId)).all()
    : db.select().from(retailerProducts).all();
}

export function listRetailerMappings(providerId?: string): RetailerMappingRow[] {
  return providerId
    ? db.select().from(retailerMappings).where(eq(retailerMappings.providerId, providerId)).all()
    : db.select().from(retailerMappings).all();
}

export function getRetailerMapping(providerId: string, retailerProductId: string): RetailerMappingRow | null {
  return db.select().from(retailerMappings)
    .where(and(eq(retailerMappings.providerId, providerId), eq(retailerMappings.retailerProductId, retailerProductId)))
    .get() ?? null;
}

export function getRetailerMappingById(id: string): RetailerMappingRow | null {
  return db.select().from(retailerMappings).where(eq(retailerMappings.id, id)).get() ?? null;
}

export interface UpsertMappingInput {
  providerId: string;
  retailerProductId: string;
  targetKind: TargetKind;
  targetId: string;
  targetName: string;
  role: MappingRole;
  /** Base unit of the target: Grocy stock unit, or a Mealie unit (null = count). */
  baseUnitId: string | null;
  baseUnitName: string | null;
  /** Explicit amount per receipt quantity unit; confirms the mapping. */
  packageBaseAmount?: number | null;
  confirm?: boolean;
}

/**
 * Create or replace the mapping of one retailer product. Without an explicit
 * package amount it is derived when possible, but stays unconfirmed: automatic
 * processing only uses confirmed mappings.
 */
export function upsertRetailerMapping(input: UpsertMappingInput, now = new Date()): RetailerMappingRow {
  const product = getRetailerProduct(input.providerId, input.retailerProductId);
  let packageBaseAmount = input.packageBaseAmount ?? null;
  let packageSource: 'derived' | 'confirmed' | null = packageBaseAmount ? 'confirmed' : null;
  if (!packageBaseAmount && product) {
    const derived = derivePackageBaseAmount({
      measure: product.measure === 'weight' ? 'weight' : 'unit',
      packageAmount: product.packageAmount,
      packageUnit: product.packageUnit,
      baseUnitName: input.baseUnitName,
    });
    if (derived) {
      packageBaseAmount = derived.amount;
      packageSource = 'derived';
    }
  }
  const confirmed = Boolean(input.confirm && packageBaseAmount && packageBaseAmount > 0);

  return db.transaction((tx) => {
    if (input.role === 'preferred') {
      // One preferred retailer product per target and provider; others become alternatives.
      tx.update(retailerMappings)
        .set({ role: 'alternative', updatedAt: now })
        .where(and(
          eq(retailerMappings.providerId, input.providerId),
          eq(retailerMappings.targetKind, input.targetKind),
          eq(retailerMappings.targetId, input.targetId),
          eq(retailerMappings.role, 'preferred'),
        ))
        .run();
    }
    const values = {
      retailerProductName: product?.name ?? input.retailerProductId,
      targetKind: input.targetKind,
      targetId: input.targetId,
      targetName: input.targetName,
      role: input.role,
      packageBaseAmount,
      packageBaseUnitId: input.baseUnitId,
      packageBaseUnitName: input.baseUnitName,
      packageSource,
      confirmed,
      updatedAt: now,
    };
    tx.insert(retailerMappings)
      .values({ id: randomUUID(), providerId: input.providerId, retailerProductId: input.retailerProductId, createdAt: now, ...values })
      .onConflictDoUpdate({ target: [retailerMappings.providerId, retailerMappings.retailerProductId], set: values })
      .run();
    // A mapping decides the suggestion pair for this product.
    tx.update(retailerSuggestions)
      .set({ status: 'rejected', decidedAt: now })
      .where(and(
        eq(retailerSuggestions.providerId, input.providerId),
        eq(retailerSuggestions.retailerProductId, input.retailerProductId),
        eq(retailerSuggestions.status, 'pending'),
      ))
      .run();
    tx.update(retailerSuggestions)
      .set({ status: 'accepted', decidedAt: now })
      .where(and(
        eq(retailerSuggestions.providerId, input.providerId),
        eq(retailerSuggestions.retailerProductId, input.retailerProductId),
        eq(retailerSuggestions.targetKind, input.targetKind),
        eq(retailerSuggestions.targetId, input.targetId),
      ))
      .run();
    return tx.select().from(retailerMappings)
      .where(and(eq(retailerMappings.providerId, input.providerId), eq(retailerMappings.retailerProductId, input.retailerProductId)))
      .get()!;
  });
}

export function confirmRetailerMapping(id: string, packageBaseAmount: number, now = new Date()): RetailerMappingRow | null {
  if (!(packageBaseAmount > 0) || !Number.isFinite(packageBaseAmount)) throw new Error('Package amount must be a positive number');
  db.update(retailerMappings)
    .set({ packageBaseAmount, packageSource: 'confirmed', confirmed: true, updatedAt: now })
    .where(eq(retailerMappings.id, id))
    .run();
  return getRetailerMappingById(id);
}

export function setRetailerMappingRole(id: string, role: MappingRole, now = new Date()): RetailerMappingRow | null {
  const mapping = getRetailerMappingById(id);
  if (!mapping) return null;
  return upsertRetailerMapping({
    providerId: mapping.providerId,
    retailerProductId: mapping.retailerProductId,
    targetKind: mapping.targetKind as TargetKind,
    targetId: mapping.targetId,
    targetName: mapping.targetName,
    role,
    baseUnitId: mapping.packageBaseUnitId,
    baseUnitName: mapping.packageBaseUnitName,
    packageBaseAmount: mapping.packageBaseAmount,
    confirm: mapping.confirmed,
  }, now);
}

export function deleteRetailerMapping(id: string): boolean {
  return db.delete(retailerMappings).where(eq(retailerMappings.id, id)).run().changes > 0;
}

/** Preferred, confirmed mapping per target, used for list projection. */
export function preferredMappingsByTarget(providerId: string): Map<string, RetailerMappingRow> {
  const map = new Map<string, RetailerMappingRow>();
  for (const mapping of listRetailerMappings(providerId)) {
    if (mapping.role === 'preferred') map.set(`${mapping.targetKind}:${mapping.targetId}`, mapping);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export interface SuggestionCandidate {
  targetKind: TargetKind;
  targetId: string;
  targetName: string;
}

/**
 * Suggest targets for unmapped retailer products. Pairs that were ever
 * suggested (pending or decided) are never suggested again.
 */
export function generateSuggestions(
  providerId: string,
  candidates: SuggestionCandidate[],
  options: { threshold?: number; perProduct?: number; now?: Date } = {},
): number {
  const now = options.now ?? new Date();
  const mapped = new Set(listRetailerMappings(providerId).map(mapping => mapping.retailerProductId));
  const known = new Set(db.select().from(retailerSuggestions).where(eq(retailerSuggestions.providerId, providerId)).all()
    .map(row => `${row.retailerProductId}|${row.targetKind}|${row.targetId}`));
  let created = 0;
  for (const product of listRetailerProducts(providerId)) {
    if (mapped.has(product.externalId)) continue;
    const matches = fuzzyMatch(product.name, candidates, candidate => candidate.targetName, options.threshold ?? 0.6, options.perProduct ?? 3);
    for (const match of matches) {
      const key = `${product.externalId}|${match.item.targetKind}|${match.item.targetId}`;
      if (known.has(key)) continue;
      known.add(key);
      db.insert(retailerSuggestions).values({
        id: randomUUID(),
        providerId,
        retailerProductId: product.externalId,
        targetKind: match.item.targetKind,
        targetId: match.item.targetId,
        targetName: match.item.targetName,
        score: match.score,
        status: 'pending',
        createdAt: now,
      }).onConflictDoNothing().run();
      created++;
    }
  }
  return created;
}

export function listSuggestions(providerId?: string, status: 'pending' | 'accepted' | 'rejected' = 'pending'): RetailerSuggestionRow[] {
  const rows = db.select().from(retailerSuggestions).where(eq(retailerSuggestions.status, status)).all();
  return rows.filter(row => !providerId || row.providerId === providerId).sort((a, b) => b.score - a.score);
}

export function rejectSuggestion(id: string, now = new Date()): boolean {
  return db.update(retailerSuggestions)
    .set({ status: 'rejected', decidedAt: now })
    .where(and(eq(retailerSuggestions.id, id), eq(retailerSuggestions.status, 'pending')))
    .run().changes > 0;
}

export function getSuggestion(id: string): RetailerSuggestionRow | null {
  return db.select().from(retailerSuggestions).where(eq(retailerSuggestions.id, id)).get() ?? null;
}
