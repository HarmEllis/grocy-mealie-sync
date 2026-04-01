import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getCurrentStock, getGrocyEntities, getVolatileStock, type CurrentStockResponse, type GrocyMissingProduct, type Product, type QuantityUnit } from '@/lib/grocy/types';
import { listOpenMappingConflicts as listOpenMappingConflictsFromStore, type MappingConflictRecord } from '@/lib/mapping-conflicts-store';
import { RecipesFoodsService, RecipesUnitsService } from '@/lib/mealie';
import { extractFoods, extractUnits, type MealieFood, type MealieUnit } from '@/lib/mealie/types';
import { getSyncState, type SyncStateData } from '@/lib/sync/state';
import type { ProductMappingRecord } from '../products/catalog';

export interface McpStatusResource {
  lastGrocyPoll: Date | null;
  lastMealiePoll: Date | null;
  grocyBelowMinStockCount: number;
  mealieTrackedItemsCount: number;
  productMappings: number;
  unitMappings: number;
}

export interface UnitMappingRecord {
  id: string;
  mealieUnitId: string;
  mealieUnitName: string;
  mealieUnitAbbreviation: string;
  grocyUnitId: number;
  grocyUnitName: string;
  conversionFactor: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductMappingsResource {
  count: number;
  mappings: ProductMappingRecord[];
}

export interface UnitMappingsResource {
  count: number;
  mappings: UnitMappingRecord[];
}

export interface UnmappedGrocyProductResource {
  id: number;
  name: string;
  quIdPurchase: number | null;
  minStockAmount: number;
  currentStock: number;
  isBelowMinimum: boolean;
}

export interface UnmappedMealieFoodResource {
  id: string;
  name: string;
}

export interface UnmappedProductsResource {
  counts: {
    grocyProducts: number;
    mealieFoods: number;
  };
  grocyProducts: UnmappedGrocyProductResource[];
  mealieFoods: UnmappedMealieFoodResource[];
}

export interface UnmappedGrocyUnitResource {
  id: number;
  name: string;
}

export interface UnmappedMealieUnitResource {
  id: string;
  name: string;
  abbreviation: string;
}

export interface UnmappedUnitsResource {
  counts: {
    grocyUnits: number;
    mealieUnits: number;
  };
  grocyUnits: UnmappedGrocyUnitResource[];
  mealieUnits: UnmappedMealieUnitResource[];
}

export interface OpenMappingConflictsResource {
  count: number;
  conflicts: MappingConflictRecord[];
}

import { listProducts, type ProductListDeps, type ProductListEntry } from '../products/list';

export interface LowStockProductResource {
  productRef: string;
  grocyProductId: number;
  grocyProductName: string;
  mealieFoodId: string | null;
  mealieFoodName: string | null;
  currentStock: number;
  minStockAmount: number;
  isBelowMinimum: boolean;
}

export interface LowStockProductsResource {
  count: number;
  products: LowStockProductResource[];
}

interface NormalizedMealieFood {
  id: string;
  name: string;
}

interface NormalizedMealieUnit {
  id: string;
  name: string;
  abbreviation: string;
}

export interface ResourceReadModelDeps {
  getSyncState(): Promise<SyncStateData>;
  listProductMappings(): Promise<ProductMappingRecord[]>;
  listUnitMappings(): Promise<UnitMappingRecord[]>;
  listOpenMappingConflicts(): Promise<MappingConflictRecord[]>;
  listGrocyProducts(): Promise<Product[]>;
  listGrocyUnits(): Promise<QuantityUnit[]>;
  listMealieFoods(): Promise<NormalizedMealieFood[]>;
  listMealieUnits(): Promise<NormalizedMealieUnit[]>;
  getCurrentStock(): Promise<CurrentStockResponse[]>;
  getVolatileStock(): Promise<{ missing_products?: GrocyMissingProduct[] }>;
}

function normalizeMealieFoods(foods: MealieFood[]): NormalizedMealieFood[] {
  return foods
    .filter((food): food is MealieFood & { id: string } => typeof food.id === 'string' && food.id.length > 0)
    .map(food => ({
      id: food.id,
      name: food.name || 'Unknown',
    }));
}

function normalizeMealieUnits(units: MealieUnit[]): NormalizedMealieUnit[] {
  return units
    .filter((unit): unit is MealieUnit & { id: string } => typeof unit.id === 'string' && unit.id.length > 0)
    .map(unit => ({
      id: unit.id,
      name: unit.name || 'Unknown',
      abbreviation: unit.abbreviation || '',
    }));
}

const defaultDeps: ResourceReadModelDeps = {
  getSyncState,
  listProductMappings: async () => db.select().from(productMappings),
  listUnitMappings: async () => db.select().from(unitMappings),
  listOpenMappingConflicts: listOpenMappingConflictsFromStore,
  listGrocyProducts: async () => getGrocyEntities('products'),
  listGrocyUnits: async () => getGrocyEntities('quantity_units'),
  listMealieFoods: async () => normalizeMealieFoods(
    extractFoods(await RecipesFoodsService.getAllApiFoodsGet(
      undefined,
      undefined,
      undefined,
      'asc',
      undefined,
      undefined,
      1,
      10000,
    )),
  ),
  listMealieUnits: async () => normalizeMealieUnits(
    extractUnits(await RecipesUnitsService.getAllApiUnitsGet(
      undefined,
      undefined,
      undefined,
      'asc',
      undefined,
      undefined,
      1,
      1000,
    )),
  ),
  getCurrentStock,
  getVolatileStock,
};

function compareByName<T extends { name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name);
}

function buildCurrentStockMap(currentStock: CurrentStockResponse[]): Map<number, number> {
  return new Map(currentStock.map(entry => [
    Number(entry.product_id),
    Number(entry.amount_aggregated ?? entry.amount ?? 0),
  ]));
}

function buildBelowMinimumSet(missingProducts: GrocyMissingProduct[] | undefined): Set<number> {
  return new Set((missingProducts ?? []).map(product => Number(product.id)));
}

export async function getStatusResource(
  deps: ResourceReadModelDeps = defaultDeps,
): Promise<McpStatusResource> {
  const [syncState, mappedProducts, mappedUnits] = await Promise.all([
    deps.getSyncState(),
    deps.listProductMappings(),
    deps.listUnitMappings(),
  ]);

  return {
    lastGrocyPoll: syncState.lastGrocyPoll,
    lastMealiePoll: syncState.lastMealiePoll,
    grocyBelowMinStockCount: Object.keys(syncState.grocyBelowMinStock).length,
    mealieTrackedItemsCount: Object.keys(syncState.mealieCheckedItems).length,
    productMappings: mappedProducts.length,
    unitMappings: mappedUnits.length,
  };
}

export async function listProductMappingsResource(
  deps: Pick<ResourceReadModelDeps, 'listProductMappings'> = defaultDeps,
): Promise<ProductMappingsResource> {
  const mappings = await deps.listProductMappings();

  return {
    count: mappings.length,
    mappings,
  };
}

export async function listUnitMappingsResource(
  deps: Pick<ResourceReadModelDeps, 'listUnitMappings'> = defaultDeps,
): Promise<UnitMappingsResource> {
  const mappings = await deps.listUnitMappings();

  return {
    count: mappings.length,
    mappings,
  };
}

export async function listUnmappedProductsResource(
  deps: Pick<
    ResourceReadModelDeps,
    'listProductMappings' | 'listGrocyProducts' | 'listMealieFoods' | 'getCurrentStock' | 'getVolatileStock'
  > = defaultDeps,
): Promise<UnmappedProductsResource> {
  const [mappings, grocyProducts, mealieFoods, currentStock, volatileStock] = await Promise.all([
    deps.listProductMappings(),
    deps.listGrocyProducts(),
    deps.listMealieFoods(),
    deps.getCurrentStock(),
    deps.getVolatileStock(),
  ]);

  const mappedGrocyIds = new Set(mappings.map(mapping => mapping.grocyProductId));
  const mappedMealieIds = new Set(mappings.map(mapping => mapping.mealieFoodId));
  const currentStockByProductId = buildCurrentStockMap(currentStock);
  const belowMinimumIds = buildBelowMinimumSet(volatileStock.missing_products);

  const unmappedGrocyProducts = grocyProducts
    .filter((product): product is Product & { id: number } => typeof product.id === 'number' && !mappedGrocyIds.has(product.id))
    .map(product => ({
      id: product.id,
      name: product.name || 'Unknown',
      quIdPurchase: product.qu_id_purchase ?? null,
      minStockAmount: Number(product.min_stock_amount ?? 0),
      currentStock: currentStockByProductId.get(product.id) ?? 0,
      isBelowMinimum: belowMinimumIds.has(product.id),
    }))
    .sort(compareByName);

  const unmappedMealieFoods = mealieFoods
    .filter(food => !mappedMealieIds.has(food.id))
    .sort(compareByName);

  return {
    counts: {
      grocyProducts: unmappedGrocyProducts.length,
      mealieFoods: unmappedMealieFoods.length,
    },
    grocyProducts: unmappedGrocyProducts,
    mealieFoods: unmappedMealieFoods,
  };
}

export async function listUnmappedUnitsResource(
  deps: Pick<ResourceReadModelDeps, 'listUnitMappings' | 'listGrocyUnits' | 'listMealieUnits'> = defaultDeps,
): Promise<UnmappedUnitsResource> {
  const [mappings, grocyUnits, mealieUnits] = await Promise.all([
    deps.listUnitMappings(),
    deps.listGrocyUnits(),
    deps.listMealieUnits(),
  ]);

  const mappedGrocyIds = new Set(mappings.map(mapping => mapping.grocyUnitId));
  const mappedMealieIds = new Set(mappings.map(mapping => mapping.mealieUnitId));

  const unmappedGrocyUnits = grocyUnits
    .filter((unit): unit is QuantityUnit & { id: number } => typeof unit.id === 'number' && !mappedGrocyIds.has(unit.id))
    .map(unit => ({
      id: unit.id,
      name: unit.name || 'Unknown',
    }))
    .sort(compareByName);

  const unmappedMealieUnits = mealieUnits
    .filter(unit => !mappedMealieIds.has(unit.id))
    .sort(compareByName);

  return {
    counts: {
      grocyUnits: unmappedGrocyUnits.length,
      mealieUnits: unmappedMealieUnits.length,
    },
    grocyUnits: unmappedGrocyUnits,
    mealieUnits: unmappedMealieUnits,
  };
}

export async function listOpenMappingConflictsResource(
  deps: Pick<ResourceReadModelDeps, 'listOpenMappingConflicts'> = defaultDeps,
): Promise<OpenMappingConflictsResource> {
  const conflicts = await deps.listOpenMappingConflicts();

  return {
    count: conflicts.length,
    conflicts,
  };
}

function toLowStockProduct(entry: ProductListEntry): LowStockProductResource {
  return {
    productRef: entry.productRef,
    grocyProductId: entry.grocyProductId,
    grocyProductName: entry.grocyProductName,
    mealieFoodId: entry.mealieFoodId,
    mealieFoodName: entry.mealieFoodName,
    currentStock: entry.currentStock,
    minStockAmount: entry.minStockAmount,
    isBelowMinimum: entry.isBelowMinimum,
  };
}

export async function listLowStockProductsResource(
  deps: ProductListDeps = {
    listProductMappings: defaultDeps.listProductMappings,
    listGrocyProducts: defaultDeps.listGrocyProducts,
    getCurrentStock: defaultDeps.getCurrentStock,
    getVolatileStock: defaultDeps.getVolatileStock,
  },
): Promise<LowStockProductsResource> {
  const result = await listProducts(
    { scope: 'mapped', belowMinimum: true },
    deps,
  );

  return {
    count: result.count,
    products: result.products.map(toLowStockProduct),
  };
}
