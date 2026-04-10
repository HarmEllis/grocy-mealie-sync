import { db } from '../db';
import { productMappings } from '../db/schema';
import { getCurrentStock, getGrocyEntities } from '../grocy/types';
import { log } from '../logger';
import { RecipesFoodsService, UsersCrudService } from '../mealie';
import type { CreateIngredientFood } from '../mealie/client/models/CreateIngredientFood';
import type { IngredientFood_Output } from '../mealie/client/models/IngredientFood_Output';
import {
  resolveMealieInPossessionOnlyAboveMinStock,
  resolveSyncMealieInPossession,
} from '../settings';
import { getSyncState, saveSyncState, type SyncStateData } from './state';

export interface MealieInPossessionSyncSummary {
  processedProducts: number;
  updatedProducts: number;
  enabledProducts: number;
  disabledProducts: number;
  unchangedProducts: number;
  failedProducts: number;
}

export interface MealieInPossessionSyncResult {
  status: 'ok' | 'skipped' | 'error';
  reason?: 'disabled';
  summary: MealieInPossessionSyncSummary;
}

function createEmptySummary(): MealieInPossessionSyncSummary {
  return {
    processedProducts: 0,
    updatedProducts: 0,
    enabledProducts: 0,
    disabledProducts: 0,
    unchangedProducts: 0,
    failedProducts: 0,
  };
}

export function shouldMarkFoodInPossession(
  currentStock: number,
  minStockAmount: number,
  onlyAboveMinStock: boolean,
): boolean {
  if (onlyAboveMinStock) {
    return currentStock > minStockAmount;
  }

  return currentStock > 0;
}

export function computeEffectiveStock(
  rawStock: number,
  openedStock: number,
  treatOpenedAsOutOfStock: boolean,
): number {
  if (!treatOpenedAsOutOfStock) return rawStock;
  return Math.max(0, rawStock - openedStock);
}

export function buildUpdatedHouseholdsWithIngredientFood(
  householdsWithIngredientFood: string[] | null | undefined,
  householdSlug: string,
  desired: boolean,
): string[] {
  const next = new Set(
    (householdsWithIngredientFood ?? []).filter((value): value is string => Boolean(value)),
  );

  if (desired) {
    next.add(householdSlug);
  } else {
    next.delete(householdSlug);
  }

  return Array.from(next);
}

function hasDesiredInPossession(
  food: Pick<IngredientFood_Output, 'householdsWithIngredientFood'>,
  householdSlug: string,
  desired: boolean,
): boolean {
  const current = new Set(food.householdsWithIngredientFood ?? []);
  return current.has(householdSlug) === desired;
}

function buildFoodUpdatePayload(
  food: IngredientFood_Output,
  householdsWithIngredientFood: string[],
): CreateIngredientFood {
  return {
    id: food.id,
    name: food.name,
    pluralName: food.pluralName ?? null,
    description: food.description ?? '',
    extras: food.extras ?? {},
    labelId: food.labelId ?? null,
    aliases: (food.aliases ?? []).map(alias => ({ name: alias.name })),
    householdsWithIngredientFood,
  };
}

function getCurrentStockAmount(rawAmount: number | undefined, aggregatedAmount: number | undefined): number {
  return Number(aggregatedAmount ?? rawAmount ?? 0);
}

async function runMealieInPossessionSync(
  state: SyncStateData,
  options: { forceFull: boolean; respectEnabledSetting: boolean },
): Promise<MealieInPossessionSyncResult> {
  const summary = createEmptySummary();

  if (options.respectEnabledSetting) {
    const syncEnabled = await resolveSyncMealieInPossession();
    if (!syncEnabled) {
      state.mealieInPossessionByGrocyProduct = {};
      return {
        status: 'skipped',
        reason: 'disabled',
        summary,
      };
    }
  }

  try {
    const onlyAboveMinStock = await resolveMealieInPossessionOnlyAboveMinStock();
    const [mappings, grocyProducts, currentStock, user] = await Promise.all([
      db.select({
        grocyProductId: productMappings.grocyProductId,
        grocyProductName: productMappings.grocyProductName,
        mealieFoodId: productMappings.mealieFoodId,
        mealieFoodName: productMappings.mealieFoodName,
      }).from(productMappings),
      getGrocyEntities('products'),
      getCurrentStock(),
      UsersCrudService.getLoggedInUserApiUsersSelfGet(),
    ]);

    const grocyProductById = new Map(
      grocyProducts.map(product => [Number(product.id), product]),
    );
    const stockByProductId = new Map(
      currentStock.map(stock => [
        Number(stock.product_id),
        getCurrentStockAmount(stock.amount, stock.amount_aggregated),
      ]),
    );
    // Grocy /api/stock returns one aggregated row per product_id — map() is correct here
    const openedStockByProductId = new Map(
      currentStock.map(stock => [
        Number(stock.product_id),
        Number(stock.amount_opened_aggregated ?? stock.amount_opened ?? 0) || 0,
      ]),
    );
    const previousTracked = state.mealieInPossessionByGrocyProduct;
    const nextTracked: Record<string, boolean> = {};

    for (const mapping of mappings) {
      summary.processedProducts++;

      const trackingKey = String(mapping.grocyProductId);
      const previousKnown = previousTracked[trackingKey];
      const grocyProduct = grocyProductById.get(mapping.grocyProductId);

      if (!grocyProduct) {
        summary.failedProducts++;
        if (previousKnown !== undefined) {
          nextTracked[trackingKey] = previousKnown;
        }
        log.warn(
          `[Grocy→Mealie] Skipping "In possession" sync for "${mapping.grocyProductName}" — Grocy product #${mapping.grocyProductId} no longer exists`,
        );
        continue;
      }

      const rawStock = stockByProductId.get(mapping.grocyProductId) ?? 0;
      const openedStock = openedStockByProductId.get(mapping.grocyProductId) ?? 0;
      // Explicit finite-number check: Number(undefined)=NaN and NaN!==0 is true, so guard against that
      const flagRaw = Number(grocyProduct.treat_opened_as_out_of_stock);
      const treatOpenedAsOutOfStock = Number.isFinite(flagRaw) ? flagRaw !== 0 : false;
      const effectiveStock = computeEffectiveStock(rawStock, openedStock, treatOpenedAsOutOfStock);
      const desired = shouldMarkFoodInPossession(
        effectiveStock,
        Number(grocyProduct.min_stock_amount ?? 0),
        onlyAboveMinStock,
      );
      const shouldEvaluate = options.forceFull || previousKnown === undefined || previousKnown !== desired;

      if (!shouldEvaluate) {
        nextTracked[trackingKey] = desired;
        summary.unchangedProducts++;
        continue;
      }

      try {
        const food = await RecipesFoodsService.getOneApiFoodsItemIdGet(mapping.mealieFoodId);

        if (hasDesiredInPossession(food, user.householdSlug, desired)) {
          nextTracked[trackingKey] = desired;
          summary.unchangedProducts++;
          continue;
        }

        await RecipesFoodsService.updateOneApiFoodsItemIdPut(
          mapping.mealieFoodId,
          buildFoodUpdatePayload(
            food,
            buildUpdatedHouseholdsWithIngredientFood(
              food.householdsWithIngredientFood,
              user.householdSlug,
              desired,
            ),
          ),
        );

        nextTracked[trackingKey] = desired;
        summary.updatedProducts++;
        if (desired) {
          summary.enabledProducts++;
        } else {
          summary.disabledProducts++;
        }

        log.info(
          `[Grocy→Mealie] ${desired ? 'Enabled' : 'Disabled'} "In possession" for "${mapping.mealieFoodName}"`,
        );
      } catch (error) {
        summary.failedProducts++;
        if (previousKnown !== undefined) {
          nextTracked[trackingKey] = previousKnown;
        }
        log.error(
          `[Grocy→Mealie] Failed to sync "In possession" for "${mapping.mealieFoodName}" (Grocy product #${mapping.grocyProductId}):`,
          error,
        );
      }
    }

    state.mealieInPossessionByGrocyProduct = nextTracked;

    if (summary.updatedProducts > 0) {
      log.info(
        `[Grocy→Mealie] Reconciled "In possession" for ${summary.updatedProducts} mapped product(s) (${summary.enabledProducts} enabled, ${summary.disabledProducts} disabled)`,
      );
    }
    if (summary.failedProducts > 0) {
      log.warn(
        `[Grocy→Mealie] "In possession" sync completed with ${summary.failedProducts} failed product(s)`,
      );
    }

    return {
      status: 'ok',
      summary,
    };
  } catch (error) {
    log.error('[Grocy→Mealie] Failed to run "In possession" sync:', error);
    return {
      status: 'error',
      summary,
    };
  }
}

export async function syncMealieInPossessionFromGrocy(
  state: SyncStateData,
): Promise<MealieInPossessionSyncResult> {
  return runMealieInPossessionSync(state, {
    forceFull: false,
    respectEnabledSetting: true,
  });
}

export async function reconcileMealieInPossessionFromGrocy(): Promise<MealieInPossessionSyncResult> {
  const state = await getSyncState();
  const result = await runMealieInPossessionSync(state, {
    forceFull: true,
    respectEnabledSetting: false,
  });

  if (result.status !== 'error') {
    state.lastGrocyPoll = new Date();
    await saveSyncState(state);
  }

  return result;
}
