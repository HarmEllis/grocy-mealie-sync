import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { mappingConflicts, productMappings, unitMappings } from './db/schema';
import { RecipesFoodsService, RecipesUnitsService } from './mealie';
import { extractFoods, extractUnits } from './mealie/types';
import { getGrocyEntities } from './grocy/types';
import { detectMappingConflicts, type DetectedMappingConflict } from './mapping-conflicts-detection';

export interface MappingConflictRecord {
  id: string;
  conflictKey: string;
  type: string;
  status: string;
  severity: string;
  mappingKind: string;
  mappingId: string;
  sourceTab: string;
  mealieId: string | null;
  mealieName: string | null;
  grocyId: number | null;
  grocyName: string | null;
  summary: string;
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}

export interface MappingConflictCheckSummary {
  detected: number;
  opened: number;
  resolved: number;
  open: number;
}

export interface MappingConflictCheckResult {
  conflicts: MappingConflictRecord[];
  openedConflicts: MappingConflictRecord[];
  resolvedConflicts: MappingConflictRecord[];
  summary: MappingConflictCheckSummary;
}

export async function listOpenMappingConflicts(): Promise<MappingConflictRecord[]> {
  const rows = await db.select().from(mappingConflicts);
  return rows
    .filter(conflict => conflict.status === 'open')
    .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());
}

export async function runMappingConflictCheck(): Promise<MappingConflictCheckResult> {
  const detected = await fetchDetectedMappingConflicts();
  const existingConflicts = await db.select().from(mappingConflicts);
  const existingConflictsByKey = new Map(
    existingConflicts.map(conflict => [conflict.conflictKey, conflict]),
  );
  const now = new Date();
  const seenKeys = new Set<string>();
  let opened = 0;
  const openedConflictIds = new Set<string>();
  const resolvedConflictIds = new Set<string>();

  for (const conflict of detected) {
    seenKeys.add(conflict.key);
    const existing = existingConflictsByKey.get(conflict.key);

    if (existing) {
      const wasOpen = existing.status === 'open';
      await db.update(mappingConflicts)
        .set({
          type: conflict.type,
          severity: conflict.severity,
          mappingKind: conflict.mappingKind,
          mappingId: conflict.mappingId,
          sourceTab: conflict.sourceTab,
          mealieId: conflict.mealieId,
          mealieName: conflict.mealieName,
          grocyId: conflict.grocyId,
          grocyName: conflict.grocyName,
          summary: conflict.summary,
          occurrences: existing.occurrences + 1,
          lastSeenAt: now,
          resolvedAt: null,
          status: 'open',
        })
        .where(eq(mappingConflicts.id, existing.id));
      if (!wasOpen) {
        opened++;
        openedConflictIds.add(existing.id);
      }
      continue;
    }

    const conflictId = randomUUID();
    await db.insert(mappingConflicts).values({
      id: conflictId,
      conflictKey: conflict.key,
      type: conflict.type,
      status: 'open',
      severity: conflict.severity,
      mappingKind: conflict.mappingKind,
      mappingId: conflict.mappingId,
      sourceTab: conflict.sourceTab,
      mealieId: conflict.mealieId,
      mealieName: conflict.mealieName,
      grocyId: conflict.grocyId,
      grocyName: conflict.grocyName,
      summary: conflict.summary,
      occurrences: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      resolvedAt: null,
    });
    opened++;
    openedConflictIds.add(conflictId);
  }

  const staleOpenConflicts = existingConflicts.filter(conflict =>
    conflict.status === 'open' && !seenKeys.has(conflict.conflictKey),
  );

  for (const conflict of staleOpenConflicts) {
    await db.update(mappingConflicts)
      .set({
        status: 'resolved',
        resolvedAt: now,
        lastSeenAt: now,
      })
      .where(eq(mappingConflicts.id, conflict.id));
    resolvedConflictIds.add(conflict.id);
  }

  const conflicts = await listOpenMappingConflicts();
  const latestConflicts = await db.select().from(mappingConflicts);
  const latestConflictsById = new Map(
    latestConflicts.map(conflict => [conflict.id, conflict]),
  );
  const openedConflicts = Array.from(openedConflictIds)
    .map(conflictId => latestConflictsById.get(conflictId))
    .filter((conflict): conflict is MappingConflictRecord => Boolean(conflict))
    .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());
  const resolvedConflicts = Array.from(resolvedConflictIds)
    .map(conflictId => latestConflictsById.get(conflictId))
    .filter((conflict): conflict is MappingConflictRecord => Boolean(conflict))
    .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());

  return {
    conflicts,
    openedConflicts,
    resolvedConflicts,
    summary: {
      detected: detected.length,
      opened,
      resolved: staleOpenConflicts.length,
      open: conflicts.length,
    },
  };
}

export async function resolveConflictsForMapping(
  mappingKind: 'product' | 'unit',
  mappingId: string,
): Promise<void> {
  const openConflicts = await db.select().from(mappingConflicts);
  const now = new Date();

  for (const conflict of openConflicts) {
    if (conflict.status !== 'open') {
      continue;
    }

    if (conflict.mappingKind !== mappingKind || conflict.mappingId !== mappingId) {
      continue;
    }

    await db.update(mappingConflicts)
      .set({
        status: 'resolved',
        resolvedAt: now,
        lastSeenAt: now,
      })
      .where(eq(mappingConflicts.id, conflict.id));
  }
}

async function fetchDetectedMappingConflicts(): Promise<DetectedMappingConflict[]> {
  const [productMappingRows, unitMappingRows, mealieFoodsRes, mealieUnitsRes, grocyProducts, grocyUnits] = await Promise.all([
    db.select({
      id: productMappings.id,
      mealieFoodId: productMappings.mealieFoodId,
      mealieFoodName: productMappings.mealieFoodName,
      grocyProductId: productMappings.grocyProductId,
      grocyProductName: productMappings.grocyProductName,
      unitMappingId: productMappings.unitMappingId,
    }).from(productMappings),
    db.select({
      id: unitMappings.id,
      mealieUnitId: unitMappings.mealieUnitId,
      mealieUnitName: unitMappings.mealieUnitName,
      grocyUnitId: unitMappings.grocyUnitId,
      grocyUnitName: unitMappings.grocyUnitName,
    }).from(unitMappings),
    RecipesFoodsService.getAllApiFoodsGet(undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000),
    RecipesUnitsService.getAllApiUnitsGet(undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000),
    getGrocyEntities('products'),
    getGrocyEntities('quantity_units'),
  ]);

  const mealieFoods = extractFoods(mealieFoodsRes)
    .filter(food => food.id)
    .map(food => ({
      id: food.id!,
      name: food.name || 'Unknown',
    }));
  const mealieUnits = extractUnits(mealieUnitsRes)
    .filter(unit => unit.id)
    .map(unit => ({
      id: unit.id!,
      name: unit.name || 'Unknown',
    }));

  return detectMappingConflicts({
    productMappings: productMappingRows,
    unitMappings: unitMappingRows,
    mealieFoods,
    mealieUnits,
    grocyProducts: grocyProducts.map(product => ({
      id: Number(product.id),
      name: product.name || 'Unknown',
    })),
    grocyUnits: grocyUnits.map(unit => ({
      id: Number(unit.id),
      name: unit.name || 'Unknown',
    })),
  });
}
