import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getGrocyEntities, updateGrocyEntity, type Product, type QuantityUnit } from '@/lib/grocy/types';
import {
  findProductMappingConflict,
  findUnitMappingConflict,
  formatProductMappingConflictMessage,
  formatUnitMappingConflictMessage,
} from '@/lib/mapping-conflicts';
import { resolveConflictsForMapping as resolveConflictsForMappingFromStore } from '@/lib/mapping-conflicts-store';
import { RecipesFoodsService, RecipesUnitsService } from '@/lib/mealie';
import type { IngredientFood_Output } from '@/lib/mealie/client/models/IngredientFood_Output';
import type { IngredientUnit_Output } from '@/lib/mealie/client/models/IngredientUnit_Output';
import { type ProductMappingRecord } from '@/lib/use-cases/products/catalog';
import { type UnitMappingRecord } from '@/lib/use-cases/resources/read-models';
import { defaultSyncLockDeps, runWithSyncLock, type SyncLockDeps } from '@/lib/use-cases/shared/sync-lock';

export interface UpsertProductMappingParams {
  mappingId?: string;
  mealieFoodId: string;
  grocyProductId: number;
  grocyUnitId?: number | null;
}

export interface UpsertProductMappingResult {
  mappingId: string;
  productRef?: string;
  mealieFoodId: string;
  mealieFoodName: string;
  grocyProductId: number;
  grocyProductName: string;
  unitMappingId: string | null;
  renamedGrocyProduct: boolean;
}

export interface RemoveProductMappingParams {
  mappingId: string;
}

export interface RemoveProductMappingResult {
  removed: true;
  mappingId: string;
}

export interface UpsertUnitMappingParams {
  mappingId?: string;
  mealieUnitId: string;
  grocyUnitId: number;
}

export interface UpsertUnitMappingResult {
  mappingId: string;
  mealieUnitId: string;
  mealieUnitName: string;
  grocyUnitId: number;
  grocyUnitName: string;
  renamedGrocyUnit: boolean;
}

export interface RemoveUnitMappingParams {
  mappingId: string;
}

export interface RemoveUnitMappingResult {
  removed: true;
  mappingId: string;
}

interface ProductMappingUpsertValues {
  mappingId?: string;
  mealieFoodId: string;
  mealieFoodName: string;
  grocyProductId: number;
  grocyProductName: string;
  unitMappingId: string | null;
}

interface UnitMappingUpsertValues {
  mappingId?: string;
  mealieUnitId: string;
  mealieUnitName: string;
  mealieUnitAbbreviation: string;
  grocyUnitId: number;
  grocyUnitName: string;
}

export interface MappingManageDeps extends SyncLockDeps {
  listProductMappings(): Promise<ProductMappingRecord[]>;
  listUnitMappings(): Promise<UnitMappingRecord[]>;
  getMealieFood(foodId: string): Promise<Pick<IngredientFood_Output, 'id' | 'name'>>;
  getGrocyProduct(productId: number): Promise<Pick<Product, 'id' | 'name'>>;
  updateGrocyProduct(productId: number, body: Record<string, unknown>): Promise<void>;
  upsertStoredProductMapping(values: ProductMappingUpsertValues): Promise<string>;
  getStoredProductMapping(mappingId: string): Promise<{ id: string } | null>;
  deleteStoredProductMapping(mappingId: string): Promise<void>;
  getMealieUnit(unitId: string): Promise<Pick<IngredientUnit_Output, 'id' | 'name' | 'abbreviation' | 'pluralName'>>;
  getGrocyUnit(unitId: number): Promise<Pick<QuantityUnit, 'id' | 'name'>>;
  updateGrocyUnit(unitId: number, body: Record<string, unknown>): Promise<void>;
  upsertStoredUnitMapping(values: UnitMappingUpsertValues): Promise<string>;
  getStoredUnitMapping(mappingId: string): Promise<{ id: string } | null>;
  deleteStoredUnitMapping(mappingId: string): Promise<void>;
  resolveConflictsForMapping(mappingKind: 'product' | 'unit', mappingId: string): Promise<void>;
}

async function getGrocyProductById(productId: number): Promise<Pick<Product, 'id' | 'name'>> {
  const product = (await getGrocyEntities('products'))
    .find(entry => Number(entry.id) === productId);

  if (!product) {
    throw new Error(`Grocy product #${productId} was not found.`);
  }

  return product;
}

async function getGrocyUnitById(unitId: number): Promise<Pick<QuantityUnit, 'id' | 'name'>> {
  const unit = (await getGrocyEntities('quantity_units'))
    .find(entry => Number(entry.id) === unitId);

  if (!unit) {
    throw new Error(`Grocy unit #${unitId} was not found.`);
  }

  return unit;
}

const defaultDeps: MappingManageDeps = {
  ...defaultSyncLockDeps,
  listProductMappings: async () => db.select().from(productMappings),
  listUnitMappings: async () => db.select().from(unitMappings),
  getMealieFood: async foodId => RecipesFoodsService.getOneApiFoodsItemIdGet(foodId),
  getGrocyProduct: getGrocyProductById,
  updateGrocyProduct: (productId, body) => updateGrocyEntity('products', productId, body),
  upsertStoredProductMapping: async values => {
    const mappingId = values.mappingId ?? randomUUID();
    const now = new Date();

    if (values.mappingId) {
      await db.update(productMappings)
        .set({
          mealieFoodId: values.mealieFoodId,
          mealieFoodName: values.mealieFoodName,
          grocyProductId: values.grocyProductId,
          grocyProductName: values.grocyProductName,
          unitMappingId: values.unitMappingId,
          updatedAt: now,
        })
        .where(eq(productMappings.id, values.mappingId));
    } else {
      await db.insert(productMappings).values({
        id: mappingId,
        mealieFoodId: values.mealieFoodId,
        mealieFoodName: values.mealieFoodName,
        grocyProductId: values.grocyProductId,
        grocyProductName: values.grocyProductName,
        unitMappingId: values.unitMappingId,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: productMappings.mealieFoodId,
        set: {
          grocyProductId: values.grocyProductId,
          grocyProductName: values.grocyProductName,
          unitMappingId: values.unitMappingId,
          updatedAt: now,
        },
      });
    }

    return mappingId;
  },
  getStoredProductMapping: async mappingId => {
    const [mapping] = await db.select().from(productMappings).where(eq(productMappings.id, mappingId)).limit(1);
    return mapping ?? null;
  },
  deleteStoredProductMapping: async mappingId => {
    await db.delete(productMappings).where(eq(productMappings.id, mappingId));
  },
  getMealieUnit: async unitId => RecipesUnitsService.getOneApiUnitsItemIdGet(unitId),
  getGrocyUnit: getGrocyUnitById,
  updateGrocyUnit: (unitId, body) => updateGrocyEntity('quantity_units', unitId, body),
  upsertStoredUnitMapping: async values => {
    const mappingId = values.mappingId ?? randomUUID();
    const now = new Date();

    if (values.mappingId) {
      await db.update(unitMappings)
        .set({
          mealieUnitId: values.mealieUnitId,
          mealieUnitName: values.mealieUnitName,
          mealieUnitAbbreviation: values.mealieUnitAbbreviation,
          grocyUnitId: values.grocyUnitId,
          grocyUnitName: values.grocyUnitName,
          updatedAt: now,
        })
        .where(eq(unitMappings.id, values.mappingId));
    } else {
      await db.insert(unitMappings).values({
        id: mappingId,
        mealieUnitId: values.mealieUnitId,
        mealieUnitName: values.mealieUnitName,
        mealieUnitAbbreviation: values.mealieUnitAbbreviation,
        grocyUnitId: values.grocyUnitId,
        grocyUnitName: values.grocyUnitName,
        conversionFactor: 1,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: unitMappings.mealieUnitId,
        set: {
          grocyUnitId: values.grocyUnitId,
          grocyUnitName: values.grocyUnitName,
          mealieUnitName: values.mealieUnitName,
          mealieUnitAbbreviation: values.mealieUnitAbbreviation,
          updatedAt: now,
        },
      });
    }

    return mappingId;
  },
  getStoredUnitMapping: async mappingId => {
    const [mapping] = await db.select().from(unitMappings).where(eq(unitMappings.id, mappingId)).limit(1);
    return mapping ?? null;
  },
  deleteStoredUnitMapping: async mappingId => {
    await db.delete(unitMappings).where(eq(unitMappings.id, mappingId));
  },
  resolveConflictsForMapping: resolveConflictsForMappingFromStore,
};

function getExistingProductMappingForMealieId(
  mappings: ProductMappingRecord[],
  mealieFoodId: string,
  mappingId?: string,
): ProductMappingRecord | null {
  return mappings.find(mapping =>
    mapping.mealieFoodId === mealieFoodId && (!mappingId || mapping.id === mappingId),
  ) ?? null;
}

function getExistingUnitMappingForMealieId(
  mappings: UnitMappingRecord[],
  mealieUnitId: string,
  mappingId?: string,
): UnitMappingRecord | null {
  return mappings.find(mapping =>
    mapping.mealieUnitId === mealieUnitId && (!mappingId || mapping.id === mappingId),
  ) ?? null;
}

export async function upsertProductMapping(
  params: UpsertProductMappingParams,
  deps: Pick<
    MappingManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'listProductMappings'
    | 'listUnitMappings'
    | 'getMealieFood'
    | 'getGrocyProduct'
    | 'updateGrocyProduct'
    | 'upsertStoredProductMapping'
  > = defaultDeps,
): Promise<UpsertProductMappingResult> {
  return runWithSyncLock(deps, async () => {
    const [existingMappings, unitMappings] = await Promise.all([
      deps.listProductMappings(),
      deps.listUnitMappings(),
    ]);

    const mealieFood = await deps.getMealieFood(params.mealieFoodId);
    const grocyProduct = await deps.getGrocyProduct(params.grocyProductId);
    const conflict = findProductMappingConflict(existingMappings, params.mealieFoodId, params.grocyProductId);
    if (conflict && conflict.id !== params.mappingId) {
      throw new Error(formatProductMappingConflictMessage(conflict, params.grocyProductId));
    }

    const unitMappingId = params.grocyUnitId
      ? unitMappings.find(mapping => mapping.grocyUnitId === params.grocyUnitId)?.id ?? null
      : null;

    let grocyProductName = grocyProduct.name || 'Unknown';
    let renamedGrocyProduct = false;

    if ((grocyProduct.name || 'Unknown') !== (mealieFood.name || 'Unknown')) {
      await deps.updateGrocyProduct(params.grocyProductId, { name: mealieFood.name || 'Unknown' });
      grocyProductName = mealieFood.name || 'Unknown';
      renamedGrocyProduct = true;
    }

    const existingMapping = getExistingProductMappingForMealieId(existingMappings, params.mealieFoodId, params.mappingId);
    const mappingId = await deps.upsertStoredProductMapping({
      mappingId: params.mappingId ?? existingMapping?.id,
      mealieFoodId: params.mealieFoodId,
      mealieFoodName: mealieFood.name || 'Unknown',
      grocyProductId: params.grocyProductId,
      grocyProductName,
      unitMappingId,
    });

    return {
      mappingId,
      productRef: `mapping:${mappingId}`,
      mealieFoodId: params.mealieFoodId,
      mealieFoodName: mealieFood.name || 'Unknown',
      grocyProductId: params.grocyProductId,
      grocyProductName,
      unitMappingId,
      renamedGrocyProduct,
    };
  });
}

export async function removeProductMapping(
  params: RemoveProductMappingParams,
  deps: Pick<
    MappingManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'getStoredProductMapping'
    | 'deleteStoredProductMapping'
    | 'resolveConflictsForMapping'
  > = defaultDeps,
): Promise<RemoveProductMappingResult> {
  return runWithSyncLock(deps, async () => {
    const existingMapping = await deps.getStoredProductMapping(params.mappingId);
    if (!existingMapping) {
      throw new Error('Product mapping not found.');
    }

    await deps.deleteStoredProductMapping(params.mappingId);
    await deps.resolveConflictsForMapping('product', params.mappingId);

    return {
      removed: true,
      mappingId: params.mappingId,
    };
  });
}

export async function upsertUnitMapping(
  params: UpsertUnitMappingParams,
  deps: Pick<
    MappingManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'listUnitMappings'
    | 'getMealieUnit'
    | 'getGrocyUnit'
    | 'updateGrocyUnit'
    | 'upsertStoredUnitMapping'
  > = defaultDeps,
): Promise<UpsertUnitMappingResult> {
  return runWithSyncLock(deps, async () => {
    const existingMappings = await deps.listUnitMappings();
    const mealieUnit = await deps.getMealieUnit(params.mealieUnitId);
    const grocyUnit = await deps.getGrocyUnit(params.grocyUnitId);
    const conflict = findUnitMappingConflict(existingMappings, params.mealieUnitId, params.grocyUnitId);
    if (conflict && conflict.id !== params.mappingId) {
      throw new Error(formatUnitMappingConflictMessage(conflict, params.grocyUnitId));
    }

    let grocyUnitName = grocyUnit.name || 'Unknown';
    let renamedGrocyUnit = false;

    if ((grocyUnit.name || 'Unknown') !== (mealieUnit.name || 'Unknown')) {
      await deps.updateGrocyUnit(params.grocyUnitId, {
        name: mealieUnit.name || 'Unknown',
        name_plural: mealieUnit.pluralName || mealieUnit.name || 'Unknown',
      });
      grocyUnitName = mealieUnit.name || 'Unknown';
      renamedGrocyUnit = true;
    }

    const existingMapping = getExistingUnitMappingForMealieId(existingMappings, params.mealieUnitId, params.mappingId);
    const mappingId = await deps.upsertStoredUnitMapping({
      mappingId: params.mappingId ?? existingMapping?.id,
      mealieUnitId: params.mealieUnitId,
      mealieUnitName: mealieUnit.name || 'Unknown',
      mealieUnitAbbreviation: mealieUnit.abbreviation || '',
      grocyUnitId: params.grocyUnitId,
      grocyUnitName,
    });

    return {
      mappingId,
      mealieUnitId: params.mealieUnitId,
      mealieUnitName: mealieUnit.name || 'Unknown',
      grocyUnitId: params.grocyUnitId,
      grocyUnitName,
      renamedGrocyUnit,
    };
  });
}

export async function removeUnitMapping(
  params: RemoveUnitMappingParams,
  deps: Pick<
    MappingManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'getStoredUnitMapping'
    | 'deleteStoredUnitMapping'
    | 'resolveConflictsForMapping'
  > = defaultDeps,
): Promise<RemoveUnitMappingResult> {
  return runWithSyncLock(deps, async () => {
    const existingMapping = await deps.getStoredUnitMapping(params.mappingId);
    if (!existingMapping) {
      throw new Error('Unit mapping not found.');
    }

    await deps.deleteStoredUnitMapping(params.mappingId);
    await deps.resolveConflictsForMapping('unit', params.mappingId);

    return {
      removed: true,
      mappingId: params.mappingId,
    };
  });
}
