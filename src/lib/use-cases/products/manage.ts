import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import {
  createGrocyEntity,
  deleteGrocyEntity,
  getGrocyEntities,
  updateGrocyEntity,
  type CreateProductBody,
  type Location,
} from '@/lib/grocy/types';
import { RecipesFoodsService } from '@/lib/mealie';
import type { CreateIngredientFood } from '@/lib/mealie/client/models/CreateIngredientFood';
import type { IngredientFood_Output } from '@/lib/mealie/client/models/IngredientFood_Output';
import {
  checkProductDuplicates,
  getProductOverview,
  type ProductDuplicateCheckResult,
  type ProductDuplicateMatch,
  type ProductMappingRecord,
  type ProductOverview,
} from './catalog';
import { defaultSyncLockDeps, runWithSyncLock, type SyncLockDeps } from '@/lib/use-cases/shared/sync-lock';

interface UnitMappingRecord {
  id: string;
  grocyUnitId: number;
}

export interface UpdateGrocyStockSettingsParams {
  productRef: string;
  minStockAmount?: number;
  treatOpenedAsOutOfStock?: boolean;
  defaultBestBeforeDays?: number | null;
  defaultBestBeforeDaysAfterOpen?: number | null;
  thawedShelfLifeDays?: number | null;
  allowFreezing?: boolean;
  frozenShelfLifeDays?: number | null;
  bestBeforeType?: 'best_before' | 'expiration';
  productGroupId?: number | null;
  locationId?: number | null;
  moveOnOpen?: boolean;
  defaultConsumeLocationId?: number | null;
}

export interface UpdateGrocyStockSettingsResult {
  productRef: string;
  grocyProductId: number;
  name: string;
  updated: {
    minStockAmount?: number;
    treatOpenedAsOutOfStock?: boolean;
    defaultBestBeforeDays?: number | null;
    defaultBestBeforeDaysAfterOpen?: number | null;
    frozenShelfLifeDays?: number | null;
    thawedShelfLifeDays?: number | null;
    bestBeforeType?: 'best_before' | 'expiration';
    allowFreezing?: boolean;
    productGroupId?: number | null;
    locationId?: number | null;
    moveOnOpen?: boolean;
    defaultConsumeLocationId?: number | null;
  };
}

export interface CreateProductInBothParams {
  name: string;
  grocyUnitId: number;
  locationId?: number | null;
  minStockAmount?: number;
  mealiePluralName?: string | null;
  mealieAliases?: string[];
}

export interface CreateProductInGrocyParams {
  name: string;
  grocyUnitId: number;
  locationId?: number | null;
  minStockAmount?: number;
}

export interface CreateProductInGrocyResult {
  created: boolean;
  productRef?: string | null;
  grocyProductId: number | null;
  grocyProductName: string | null;
  duplicateCheck: {
    skipped: boolean;
    exactGrocyMatches: number;
  };
}

export interface CreateProductInMealieParams {
  name: string;
  pluralName?: string | null;
  aliases?: string[];
}

export interface CreateProductInMealieResult {
  created: boolean;
  productRef?: string | null;
  mealieFoodId: string | null;
  mealieFoodName: string | null;
  duplicateCheck: {
    skipped: boolean;
    exactMealieMatches: number;
  };
}

export interface CreateProductInBothResult {
  created: boolean;
  productRef?: string | null;
  grocyProductRef?: string | null;
  mealieProductRef?: string | null;
  grocyProductId: number | null;
  grocyProductName: string | null;
  mealieFoodId: string | null;
  mealieFoodName: string | null;
  unitMappingId: string | null;
  duplicateCheck: {
    skipped: boolean;
    exactGrocyMatches: number;
    exactMealieMatches: number;
  };
}

export interface UpdateBasicProductParams {
  productRef: string;
  grocyName?: string;
  mealieName?: string;
  mealiePluralName?: string | null;
  mealieAliases?: string[];
}

export interface UpdateBasicProductResult {
  productRef: string;
  grocyProductId: number | null;
  mealieFoodId: string | null;
  updated: {
    grocyName?: string;
    mealieName?: string;
    mealiePluralName?: string | null;
    mealieAliases?: string[];
  };
}

export interface DeleteProductParams {
  productRef: string;
  system: 'grocy' | 'mealie';
}

export interface DeleteProductResult {
  deleted: true;
  system: 'grocy' | 'mealie';
  productId: number | string;
}

export interface UpdateProductUnitsParams {
  productRef: string;
  grocyUnitIdPurchase?: number;
  grocyUnitIdStock?: number;
}

export interface UpdateProductUnitsResult {
  productRef: string;
  grocyProductId: number;
  updated: {
    quIdPurchase?: number;
    quIdStock?: number;
  };
}

export interface ProductManageDeps extends SyncLockDeps {
  getProductOverview(params: { productRef: string }): Promise<ProductOverview>;
  getMealieFood(foodId: string): Promise<IngredientFood_Output>;
  updateGrocyProduct(productId: number, body: Record<string, unknown>): Promise<void>;
  updateMealieFood(foodId: string, body: CreateIngredientFood): Promise<void>;
  checkProductDuplicates(params: { name: string }): Promise<ProductDuplicateCheckResult>;
  listGrocyLocations(): Promise<Location[]>;
  listUnitMappings(): Promise<UnitMappingRecord[]>;
  listProductMappings(): Promise<ProductMappingRecord[]>;
  createGrocyProduct(body: CreateProductBody): Promise<{ createdObjectId: number }>;
  createMealieFood(body: CreateIngredientFood): Promise<IngredientFood_Output>;
  deleteGrocyProduct(productId: number): Promise<void>;
  deleteMealieFood(foodId: string): Promise<void>;
  insertProductMapping(values: {
    mealieFoodId: string;
    mealieFoodName: string;
    grocyProductId: number;
    grocyProductName: string;
    unitMappingId: string | null;
  }): Promise<string>;
}

const defaultDeps: ProductManageDeps = {
  ...defaultSyncLockDeps,
  getProductOverview,
  getMealieFood: foodId => RecipesFoodsService.getOneApiFoodsItemIdGet(foodId),
  updateGrocyProduct: (productId, body) => updateGrocyEntity('products', productId, body),
  updateMealieFood: async (foodId, body) => {
    await RecipesFoodsService.updateOneApiFoodsItemIdPut(foodId, body);
  },
  checkProductDuplicates: params => checkProductDuplicates({ name: params.name }),
  listGrocyLocations: async () => getGrocyEntities('locations'),
  listUnitMappings: async () => db.select({
    id: unitMappings.id,
    grocyUnitId: unitMappings.grocyUnitId,
  }).from(unitMappings),
  listProductMappings: async () => db.select().from(productMappings),
  createGrocyProduct: async body => {
    const result = await createGrocyEntity('products', body);
    const createdObjectId = Number(result.created_object_id ?? 0);

    if (!createdObjectId) {
      throw new Error('Grocy did not return a created product id.');
    }

    return { createdObjectId };
  },
  createMealieFood: body => RecipesFoodsService.createOneApiFoodsPost(body),
  deleteGrocyProduct: productId => deleteGrocyEntity('products', productId),
  deleteMealieFood: foodId => RecipesFoodsService.deleteOneApiFoodsItemIdDelete(foodId).then(() => undefined),
  insertProductMapping: async values => {
    const mappingId = randomUUID();

    await db.insert(productMappings).values({
      id: mappingId,
      mealieFoodId: values.mealieFoodId,
      mealieFoodName: values.mealieFoodName,
      grocyProductId: values.grocyProductId,
      grocyProductName: values.grocyProductName,
      unitMappingId: values.unitMappingId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return mappingId;
  },
};

function requireGrocyProduct(overview: ProductOverview): NonNullable<ProductOverview['grocyProduct']> {
  if (!overview.grocyProduct) {
    throw new Error(`Product ${overview.productRef} does not exist in Grocy.`);
  }

  return overview.grocyProduct;
}

function createExactDuplicateSummary(result: ProductDuplicateCheckResult) {
  return {
    skipped: result.exactGrocyMatches.length > 0 || result.exactMealieMatches.length > 0,
    exactGrocyMatches: result.exactGrocyMatches.length,
    exactMealieMatches: result.exactMealieMatches.length,
  };
}

function requireLocationId(locations: Location[], requestedLocationId?: number | null): number {
  if (requestedLocationId) {
    return requestedLocationId;
  }

  const firstLocationId = Number(locations[0]?.id ?? 0);
  if (!firstLocationId) {
    throw new Error('No Grocy locations are available.');
  }

  return firstLocationId;
}

function toMealieAliases(aliases: string[] | undefined) {
  return (aliases ?? [])
    .map(alias => alias.trim())
    .filter(Boolean)
    .map(name => ({ name }));
}

function toGrocyProductRef(productId: number | null | undefined): string | null {
  return productId ? `grocy:${productId}` : null;
}

function toMealieProductRef(foodId: string | null | undefined): string | null {
  return foodId ? `mealie:${foodId}` : null;
}

export async function updateGrocyStockSettings(
  params: UpdateGrocyStockSettingsParams,
  deps: Pick<
    ProductManageDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'getProductOverview' | 'updateGrocyProduct'
  > = defaultDeps,
): Promise<UpdateGrocyStockSettingsResult> {
  return runWithSyncLock(deps, async () => {
    const overview = await deps.getProductOverview({ productRef: params.productRef });
    const grocyProduct = requireGrocyProduct(overview);
    const update: Record<string, unknown> = {};
    const updated: UpdateGrocyStockSettingsResult['updated'] = {};

    if (params.minStockAmount !== undefined) {
      update.min_stock_amount = params.minStockAmount;
      updated.minStockAmount = params.minStockAmount;
    }

    if (params.treatOpenedAsOutOfStock !== undefined) {
      update.treat_opened_as_out_of_stock = params.treatOpenedAsOutOfStock ? 1 : 0;
      updated.treatOpenedAsOutOfStock = params.treatOpenedAsOutOfStock;
    }

    if (params.defaultBestBeforeDays !== undefined) {
      update.default_best_before_days = params.defaultBestBeforeDays;
      updated.defaultBestBeforeDays = params.defaultBestBeforeDays;
    }

    if (params.defaultBestBeforeDaysAfterOpen !== undefined) {
      update.default_best_before_days_after_open = params.defaultBestBeforeDaysAfterOpen;
      updated.defaultBestBeforeDaysAfterOpen = params.defaultBestBeforeDaysAfterOpen;
    }

    if (params.frozenShelfLifeDays !== undefined) {
      update.default_best_before_days_after_freezing = params.frozenShelfLifeDays;
      updated.frozenShelfLifeDays = params.frozenShelfLifeDays;
    }

    if (params.thawedShelfLifeDays !== undefined) {
      update.default_best_before_days_after_thawing = params.thawedShelfLifeDays;
      updated.thawedShelfLifeDays = params.thawedShelfLifeDays;
    }

    if (params.bestBeforeType !== undefined) {
      update.due_type = params.bestBeforeType === 'expiration'
        ? 2
        : 1;
      updated.bestBeforeType = params.bestBeforeType;
    }

    if (params.allowFreezing !== undefined) {
      update.should_not_be_frozen = params.allowFreezing ? 0 : 1;
      updated.allowFreezing = params.allowFreezing;
    }

    if (params.productGroupId !== undefined) {
      update.product_group_id = params.productGroupId;
      updated.productGroupId = params.productGroupId;
    }

    if (params.locationId !== undefined) {
      update.location_id = params.locationId;
      updated.locationId = params.locationId;
    }

    if (params.moveOnOpen !== undefined) {
      update.move_on_open = params.moveOnOpen ? 1 : 0;
      updated.moveOnOpen = params.moveOnOpen;
    }

    if (params.defaultConsumeLocationId !== undefined) {
      update.default_consume_location_id = params.defaultConsumeLocationId;
      updated.defaultConsumeLocationId = params.defaultConsumeLocationId;
    }

    await deps.updateGrocyProduct(grocyProduct.id, update);

    return {
      productRef: params.productRef,
      grocyProductId: grocyProduct.id,
      name: grocyProduct.name,
      updated,
    };
  });
}

export async function createProductInBoth(
  params: CreateProductInBothParams,
  deps: Pick<
    ProductManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'checkProductDuplicates'
    | 'listGrocyLocations'
    | 'listUnitMappings'
    | 'createGrocyProduct'
    | 'createMealieFood'
    | 'deleteGrocyProduct'
    | 'deleteMealieFood'
    | 'insertProductMapping'
  > = defaultDeps,
): Promise<CreateProductInBothResult> {
  return runWithSyncLock(deps, async () => {
    const duplicateCheck = await deps.checkProductDuplicates({ name: params.name });
    const duplicateSummary = createExactDuplicateSummary(duplicateCheck);

    if (duplicateSummary.skipped) {
      const grocyProductRef = duplicateCheck.exactGrocyMatches[0]?.productRef ?? null;
      const mealieProductRef = duplicateCheck.exactMealieMatches[0]?.productRef ?? null;

      return {
        created: false,
        productRef: grocyProductRef ?? mealieProductRef,
        grocyProductRef,
        mealieProductRef,
        grocyProductId: duplicateCheck.exactGrocyMatches[0]?.id ?? null,
        grocyProductName: duplicateCheck.exactGrocyMatches[0]?.name ?? null,
        mealieFoodId: duplicateCheck.exactMealieMatches[0]?.id ?? null,
        mealieFoodName: duplicateCheck.exactMealieMatches[0]?.name ?? null,
        unitMappingId: null,
        duplicateCheck: duplicateSummary,
      };
    }

    const locationId = requireLocationId(await deps.listGrocyLocations(), params.locationId);
    const unitMappingId = (await deps.listUnitMappings())
      .find(mapping => mapping.grocyUnitId === params.grocyUnitId)?.id ?? null;

    let createdGrocyProductId: number | null = null;
    let createdMealieFoodId: string | null = null;

    try {
      const grocyResult = await deps.createGrocyProduct({
        name: params.name,
        min_stock_amount: params.minStockAmount ?? 0,
        qu_id_purchase: params.grocyUnitId,
        qu_id_stock: params.grocyUnitId,
        location_id: locationId,
      });
      createdGrocyProductId = grocyResult.createdObjectId;

      const mealieFood = await deps.createMealieFood({
        name: params.name,
        pluralName: params.mealiePluralName ?? null,
        aliases: toMealieAliases(params.mealieAliases),
      });
      createdMealieFoodId = mealieFood.id;

      const mappingId = await deps.insertProductMapping({
        mealieFoodId: mealieFood.id,
        mealieFoodName: mealieFood.name || params.name,
        grocyProductId: createdGrocyProductId,
        grocyProductName: params.name,
        unitMappingId,
      });

      return {
        created: true,
        productRef: `mapping:${mappingId}`,
        grocyProductRef: toGrocyProductRef(createdGrocyProductId),
        mealieProductRef: toMealieProductRef(mealieFood.id),
        grocyProductId: createdGrocyProductId,
        grocyProductName: params.name,
        mealieFoodId: mealieFood.id,
        mealieFoodName: mealieFood.name || params.name,
        unitMappingId,
        duplicateCheck: duplicateSummary,
      };
    } catch (error) {
      if (createdMealieFoodId) {
        await deps.deleteMealieFood(createdMealieFoodId).catch(() => undefined);
      }
      if (createdGrocyProductId) {
        await deps.deleteGrocyProduct(createdGrocyProductId).catch(() => undefined);
      }
      throw error;
    }
  });
}

export async function createProductInGrocy(
  params: CreateProductInGrocyParams,
  deps: Pick<
    ProductManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'checkProductDuplicates'
    | 'listGrocyLocations'
    | 'createGrocyProduct'
  > = defaultDeps,
): Promise<CreateProductInGrocyResult> {
  return runWithSyncLock(deps, async () => {
    const duplicateCheck = await deps.checkProductDuplicates({ name: params.name });
    const duplicateSummary = {
      skipped: duplicateCheck.exactGrocyMatches.length > 0,
      exactGrocyMatches: duplicateCheck.exactGrocyMatches.length,
    };

    if (duplicateSummary.skipped) {
      return {
        created: false,
        productRef: duplicateCheck.exactGrocyMatches[0]?.productRef ?? null,
        grocyProductId: duplicateCheck.exactGrocyMatches[0]?.id ?? null,
        grocyProductName: duplicateCheck.exactGrocyMatches[0]?.name ?? null,
        duplicateCheck: duplicateSummary,
      };
    }

    const locationId = requireLocationId(await deps.listGrocyLocations(), params.locationId);
    const grocyResult = await deps.createGrocyProduct({
      name: params.name,
      min_stock_amount: params.minStockAmount ?? 0,
      qu_id_purchase: params.grocyUnitId,
      qu_id_stock: params.grocyUnitId,
      location_id: locationId,
    });

    return {
      created: true,
      productRef: toGrocyProductRef(grocyResult.createdObjectId),
      grocyProductId: grocyResult.createdObjectId,
      grocyProductName: params.name,
      duplicateCheck: duplicateSummary,
    };
  });
}

export async function createProductInMealie(
  params: CreateProductInMealieParams,
  deps: Pick<
    ProductManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'checkProductDuplicates'
    | 'createMealieFood'
  > = defaultDeps,
): Promise<CreateProductInMealieResult> {
  return runWithSyncLock(deps, async () => {
    const duplicateCheck = await deps.checkProductDuplicates({ name: params.name });
    const duplicateSummary = {
      skipped: duplicateCheck.exactMealieMatches.length > 0,
      exactMealieMatches: duplicateCheck.exactMealieMatches.length,
    };

    if (duplicateSummary.skipped) {
      return {
        created: false,
        productRef: duplicateCheck.exactMealieMatches[0]?.productRef ?? null,
        mealieFoodId: duplicateCheck.exactMealieMatches[0]?.id ?? null,
        mealieFoodName: duplicateCheck.exactMealieMatches[0]?.name ?? null,
        duplicateCheck: duplicateSummary,
      };
    }

    const mealieFood = await deps.createMealieFood({
      name: params.name,
      pluralName: params.pluralName ?? null,
      aliases: toMealieAliases(params.aliases),
    });

    return {
      created: true,
      productRef: toMealieProductRef(mealieFood.id),
      mealieFoodId: mealieFood.id,
      mealieFoodName: mealieFood.name || params.name,
      duplicateCheck: duplicateSummary,
    };
  });
}

export async function updateBasicProduct(
  params: UpdateBasicProductParams,
  deps: Pick<
    ProductManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'getProductOverview'
    | 'getMealieFood'
    | 'updateGrocyProduct'
    | 'updateMealieFood'
  > = defaultDeps,
): Promise<UpdateBasicProductResult> {
  return runWithSyncLock(deps, async () => {
    const overview = await deps.getProductOverview({ productRef: params.productRef });

    if (params.grocyName && overview.grocyProduct) {
      await deps.updateGrocyProduct(overview.grocyProduct.id, { name: params.grocyName });
    }

    if ((params.mealieName || params.mealiePluralName !== undefined || params.mealieAliases) && overview.mealieFood) {
      const currentFood = await deps.getMealieFood(overview.mealieFood.id);
      await deps.updateMealieFood(overview.mealieFood.id, {
        id: currentFood.id,
        name: params.mealieName ?? currentFood.name,
        pluralName: params.mealiePluralName ?? currentFood.pluralName ?? null,
        description: currentFood.description,
        extras: currentFood.extras,
        labelId: currentFood.labelId,
        aliases: params.mealieAliases ? toMealieAliases(params.mealieAliases) : (currentFood.aliases ?? []).map(alias => ({ name: alias.name || '' })).filter(alias => alias.name),
      });
    }

    return {
      productRef: params.productRef,
      grocyProductId: overview.grocyProduct?.id ?? null,
      mealieFoodId: overview.mealieFood?.id ?? null,
      updated: {
        grocyName: params.grocyName,
        mealieName: params.mealieName,
        mealiePluralName: params.mealiePluralName,
        mealieAliases: params.mealieAliases,
      },
    };
  });
}

export async function deleteProduct(
  params: DeleteProductParams,
  deps: Pick<
    ProductManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'getProductOverview'
    | 'listProductMappings'
    | 'deleteGrocyProduct'
    | 'deleteMealieFood'
  > = defaultDeps,
): Promise<DeleteProductResult> {
  return runWithSyncLock(deps, async () => {
    const overview = await deps.getProductOverview({ productRef: params.productRef });
    const mappings = await deps.listProductMappings();

    if (params.system === 'grocy') {
      if (!overview.grocyProduct) {
        throw new Error('Product does not exist in Grocy.');
      }

      const isMapped = mappings.some(
        m => m.grocyProductId === overview.grocyProduct!.id,
      );
      if (isMapped) {
        throw new Error('Cannot delete a mapped product. Remove the mapping first.');
      }

      await deps.deleteGrocyProduct(overview.grocyProduct.id);

      return {
        deleted: true,
        system: 'grocy',
        productId: overview.grocyProduct.id,
      };
    }

    if (!overview.mealieFood) {
      throw new Error('Product does not exist in Mealie.');
    }

    const isMapped = mappings.some(
      m => m.mealieFoodId === overview.mealieFood!.id,
    );
    if (isMapped) {
      throw new Error('Cannot delete a mapped product. Remove the mapping first.');
    }

    await deps.deleteMealieFood(overview.mealieFood.id);

    return {
      deleted: true,
      system: 'mealie',
      productId: overview.mealieFood.id,
    };
  });
}

export async function updateProductUnits(
  params: UpdateProductUnitsParams,
  deps: Pick<
    ProductManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'getProductOverview'
    | 'updateGrocyProduct'
  > = defaultDeps,
): Promise<UpdateProductUnitsResult> {
  return runWithSyncLock(deps, async () => {
    const overview = await deps.getProductOverview({ productRef: params.productRef });
    const grocyProduct = requireGrocyProduct(overview);

    const update: Record<string, unknown> = {};
    const updated: UpdateProductUnitsResult['updated'] = {};

    if (params.grocyUnitIdPurchase !== undefined) {
      update.qu_id_purchase = params.grocyUnitIdPurchase;
      updated.quIdPurchase = params.grocyUnitIdPurchase;
    }

    if (params.grocyUnitIdStock !== undefined) {
      update.qu_id_stock = params.grocyUnitIdStock;
      updated.quIdStock = params.grocyUnitIdStock;
    }

    if (Object.keys(update).length === 0) {
      throw new Error('At least one unit field must be provided.');
    }

    await deps.updateGrocyProduct(grocyProduct.id, update);

    return {
      productRef: params.productRef,
      grocyProductId: grocyProduct.id,
      updated,
    };
  });
}
