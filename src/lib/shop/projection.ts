import { createHash, randomUUID } from 'crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db';
import { shopExportAllocations, shopExports } from '../db/schema';
import type { SubProductItem } from '../shopping-notes';
import {
  mappingBaseUnitValid,
  mealieQuantityToGrocyStock,
  mealieQuantityToMealieBase,
  type ConversionFailure,
  type TargetKind,
  type UnitContext,
} from './units';

export interface ProjectionDemand {
  revisionId: string;
  mealieItemId: string;
  foodId: string | null;
  unitId: string | null;
  quantity: number;
  subItems: SubProductItem[] | null;
  label: string;
}

export interface ProjectionMapping {
  retailerProductId: string;
  targetKind: TargetKind;
  targetId: string;
  packageBaseAmount: number | null;
  packageBaseUnitId: string | null;
  confirmed: boolean;
}

export interface ProjectionAllocation {
  revisionId: string;
  mealieItemId: string;
  targetKind: TargetKind;
  targetId: string;
  baseAmount: number;
  rowFactor: number;
}

export interface ProjectedLine {
  retailerProductId: string;
  packages: number;
  baseAmount: number;
  allocations: ProjectionAllocation[];
}

export type ProjectionReviewReason = 'no_food' | 'no_retailer_mapping' | 'mapping_unconfirmed' | 'mapping_unit_changed' | ConversionFailure;

export interface ProjectionReview {
  mealieItemId: string;
  revisionId: string;
  label: string;
  reason: ProjectionReviewReason;
}

const EPSILON = 1e-9;

export function targetKey(kind: TargetKind, id: string | number): string {
  return `${kind}:${id}`;
}

/** Mealie treats a missing or zero quantity as one item; so does the manual check flow. */
function effectiveQuantity(quantity: number): number {
  return quantity > 0 ? quantity : 1;
}

/**
 * Project open demand onto retailer products. Compatible demand for the same
 * retailer product is summed in the base unit first and rounded to whole
 * packages once, so one package can serve several rows.
 */
export function projectDemand(
  demands: ProjectionDemand[],
  preferredByTarget: Map<string, ProjectionMapping>,
  ctx: UnitContext,
): { lines: ProjectedLine[]; review: ProjectionReview[] } {
  const grouped = new Map<string, { mapping: ProjectionMapping; allocations: ProjectionAllocation[] }>();
  const review: ProjectionReview[] = [];

  const allocate = (demand: ProjectionDemand, mapping: ProjectionMapping, baseAmount: number, rowFactor: number) => {
    const group = grouped.get(mapping.retailerProductId) ?? { mapping, allocations: [] };
    group.allocations.push({
      revisionId: demand.revisionId,
      mealieItemId: demand.mealieItemId,
      targetKind: mapping.targetKind,
      targetId: mapping.targetId,
      baseAmount,
      rowFactor,
    });
    grouped.set(mapping.retailerProductId, group);
  };

  const usableMapping = (demand: ProjectionDemand, mapping: ProjectionMapping | undefined): mapping is ProjectionMapping => {
    if (!mapping) {
      review.push({ mealieItemId: demand.mealieItemId, revisionId: demand.revisionId, label: demand.label, reason: 'no_retailer_mapping' });
      return false;
    }
    if (!mapping.confirmed || !mapping.packageBaseAmount || mapping.packageBaseAmount <= 0) {
      review.push({ mealieItemId: demand.mealieItemId, revisionId: demand.revisionId, label: demand.label, reason: 'mapping_unconfirmed' });
      return false;
    }
    if (!mappingBaseUnitValid(ctx, mapping)) {
      // The target's unit changed since confirmation; the amount must be confirmed again.
      review.push({ mealieItemId: demand.mealieItemId, revisionId: demand.revisionId, label: demand.label, reason: 'mapping_unit_changed' });
      return false;
    }
    return true;
  };

  for (const demand of demands) {
    if (demand.subItems && demand.subItems.length > 0) {
      // Sub-product rows carry per-child amounts in each child's stock unit.
      const parentId = demand.foodId ? ctx.foodToGrocyProduct.get(demand.foodId) : undefined;
      for (const child of demand.subItems) {
        let mapping = preferredByTarget.get(targetKey('grocy_product', child.grocyProductId));
        if (!mapping && parentId !== undefined) {
          const parent = ctx.grocyProducts.get(parentId);
          const childInfo = ctx.grocyProducts.get(child.grocyProductId);
          // The parent's retailer product may serve a child when both use the same stock unit.
          if (parent && childInfo && parent.quIdStock !== null && parent.quIdStock === childInfo.quIdStock) {
            mapping = preferredByTarget.get(targetKey('grocy_product', parentId));
          }
        }
        if (!usableMapping({ ...demand, label: `${demand.label} (${child.name})` }, mapping)) continue;
        allocate(demand, mapping, child.amount, 1);
      }
      continue;
    }

    if (!demand.foodId) {
      review.push({ mealieItemId: demand.mealieItemId, revisionId: demand.revisionId, label: demand.label, reason: 'no_food' });
      continue;
    }
    const quantity = effectiveQuantity(demand.quantity);
    const grocyProductId = ctx.foodToGrocyProduct.get(demand.foodId);
    const grocyMapping = grocyProductId !== undefined ? preferredByTarget.get(targetKey('grocy_product', grocyProductId)) : undefined;
    const foodMapping = preferredByTarget.get(targetKey('mealie_food', demand.foodId));
    const mapping = grocyMapping ?? foodMapping;
    if (!usableMapping(demand, mapping)) continue;

    const converted = mapping.targetKind === 'grocy_product'
      ? mealieQuantityToGrocyStock(ctx, Number(mapping.targetId), quantity, demand.unitId)
      : mealieQuantityToMealieBase(ctx, quantity, demand.unitId, mapping.packageBaseUnitId);
    if (!converted.ok) {
      review.push({ mealieItemId: demand.mealieItemId, revisionId: demand.revisionId, label: demand.label, reason: converted.reason });
      continue;
    }
    allocate(demand, mapping, converted.amount, converted.factor);
  }

  const lines: ProjectedLine[] = [];
  for (const [retailerProductId, group] of grouped) {
    const baseAmount = group.allocations.reduce((sum, allocation) => sum + allocation.baseAmount, 0);
    const packageSize = group.mapping.packageBaseAmount!;
    const packages = baseAmount > EPSILON ? Math.ceil(baseAmount / packageSize - EPSILON) : 0;
    lines.push({ retailerProductId, packages, baseAmount, allocations: group.allocations });
  }
  lines.sort((a, b) => a.retailerProductId.localeCompare(b.retailerProductId));
  return { lines, review };
}

function exportFingerprint(line: ProjectedLine): string {
  const allocations = line.allocations
    .map(allocation => [allocation.revisionId, Math.round(allocation.baseAmount * 1e6) / 1e6])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return createHash('sha256').update(JSON.stringify([line.packages, allocations])).digest('hex').slice(0, 32);
}

export type ShopExportRow = typeof shopExports.$inferSelect;
export type ShopExportAllocationRow = typeof shopExportAllocations.$inferSelect;

/**
 * Write a new export version only for retailer products whose grouped
 * allocation changed. Old versions are superseded, never deleted.
 */
export function persistExports(installationId: string, providerId: string, lines: ProjectedLine[], now = new Date()): { written: number; superseded: number } {
  let written = 0;
  let superseded = 0;
  db.transaction((tx) => {
    const active = tx.select().from(shopExports)
      .where(and(eq(shopExports.installationId, installationId), isNull(shopExports.supersededAt)))
      .all();
    const activeByProduct = new Map(active.map(row => [row.retailerProductId, row]));
    const seen = new Set<string>();
    for (const line of lines) {
      seen.add(line.retailerProductId);
      const fingerprint = exportFingerprint(line);
      const current = activeByProduct.get(line.retailerProductId);
      if (current && current.fingerprint === fingerprint) continue;
      if (current) {
        tx.update(shopExports).set({ supersededAt: now }).where(eq(shopExports.id, current.id)).run();
        superseded++;
      }
      const exportId = randomUUID();
      tx.insert(shopExports).values({
        id: exportId,
        installationId,
        providerId,
        retailerProductId: line.retailerProductId,
        packages: line.packages,
        baseAmount: line.baseAmount,
        fingerprint,
        createdAt: now,
      }).run();
      for (const allocation of line.allocations) {
        tx.insert(shopExportAllocations).values({
          id: randomUUID(),
          exportId,
          demandRevisionId: allocation.revisionId,
          mealieItemId: allocation.mealieItemId,
          targetKind: allocation.targetKind,
          targetId: allocation.targetId,
          baseAmount: allocation.baseAmount,
          rowFactor: allocation.rowFactor,
        }).run();
      }
      written++;
    }
    for (const row of active) {
      if (seen.has(row.retailerProductId)) continue;
      tx.update(shopExports).set({ supersededAt: now }).where(eq(shopExports.id, row.id)).run();
      superseded++;
    }
  });
  return { written, superseded };
}

export function listActiveExports(installationId?: string): ShopExportRow[] {
  const rows = db.select().from(shopExports).where(isNull(shopExports.supersededAt)).all();
  return installationId ? rows.filter(row => row.installationId === installationId) : rows;
}

/** Export versions of a product that were active at `at` (receipt purchase time). */
export function exportsActiveAt(installationId: string, retailerProductId: string, at: Date): ShopExportRow[] {
  return db.select().from(shopExports)
    .where(and(eq(shopExports.installationId, installationId), eq(shopExports.retailerProductId, retailerProductId)))
    .all()
    .filter(row => row.createdAt.getTime() <= at.getTime() && (!row.supersededAt || row.supersededAt.getTime() > at.getTime()));
}

export function listExportsForProduct(installationId: string, retailerProductId: string): ShopExportRow[] {
  return db.select().from(shopExports)
    .where(and(eq(shopExports.installationId, installationId), eq(shopExports.retailerProductId, retailerProductId)))
    .all();
}

export function listAllocations(exportIds: string[]): ShopExportAllocationRow[] {
  if (exportIds.length === 0) return [];
  return db.select().from(shopExportAllocations).where(inArray(shopExportAllocations.exportId, exportIds)).all();
}

export function allocationsForRevision(revisionId: string): ShopExportAllocationRow[] {
  return db.select().from(shopExportAllocations).where(eq(shopExportAllocations.demandRevisionId, revisionId)).all();
}
