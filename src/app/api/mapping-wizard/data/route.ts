import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getCurrentStock, getGrocyEntities, getVolatileStock } from '@/lib/grocy/types';
import { RecipesFoodsService, RecipesUnitsService } from '@/lib/mealie';
import { extractFoods, extractUnits } from '@/lib/mealie/types';
import { fuzzyMatch } from '@/lib/fuzzy-match';
import { log } from '@/lib/logger';
import type {
  GrocyMinStockProduct,
  GrocyMinStockTabData,
  GrocyProduct,
  GrocyUnit,
  MealieFood,
  MealieUnit,
  ProductsTabData,
  UnitMappingRef,
  UnitsTabData,
  WizardData,
} from '@/components/mapping-wizard/types';

interface ProductMappingRow {
  mealieFoodId: string;
  grocyProductId: number;
}

interface UnitMappingRow extends UnitMappingRef {
  mealieUnitId: string;
}

async function fetchMealieFoods(): Promise<MealieFood[]> {
  const mealieFoodsRes = await RecipesFoodsService.getAllApiFoodsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
  );

  return extractFoods(mealieFoodsRes)
    .filter(food => food.id)
    .map(food => ({
      id: food.id,
      name: food.name || 'Unknown',
    }));
}

async function fetchMealieUnits(): Promise<MealieUnit[]> {
  const mealieUnitsRes = await RecipesUnitsService.getAllApiUnitsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
  );

  return extractUnits(mealieUnitsRes)
    .filter(unit => unit.id)
    .map(unit => ({
      id: unit.id,
      name: unit.name || 'Unknown',
      abbreviation: unit.abbreviation || '',
    }));
}

async function fetchGrocyProducts(): Promise<GrocyProduct[]> {
  const grocyProducts = await getGrocyEntities('products');
  return grocyProducts.map(product => ({
    id: Number(product.id),
    name: product.name || 'Unknown',
    quIdPurchase: Number(product.qu_id_purchase || 0),
    minStockAmount: Number(product.min_stock_amount || 0),
  }));
}

async function fetchGrocyUnits(): Promise<GrocyUnit[]> {
  const grocyUnits = await getGrocyEntities('quantity_units');
  return grocyUnits.map(unit => ({
    id: Number(unit.id),
    name: unit.name || 'Unknown',
  }));
}

async function fetchGrocyCurrentStockByProductId(): Promise<Map<number, number>> {
  const currentStock = await getCurrentStock();

  return new Map(currentStock.map(stock => [
    Number(stock.product_id),
    Number(stock.amount_aggregated ?? stock.amount ?? 0),
  ]));
}

async function fetchGrocyMissingProductIds(): Promise<Set<number>> {
  const volatileStock = await getVolatileStock();
  return new Set((volatileStock.missing_products ?? []).map(product => Number(product.id)));
}

async function fetchExistingProductMappings(): Promise<ProductMappingRow[]> {
  return db.select({
    mealieFoodId: productMappings.mealieFoodId,
    grocyProductId: productMappings.grocyProductId,
  }).from(productMappings);
}

async function fetchExistingUnitMappings(): Promise<UnitMappingRow[]> {
  return db.select({
    id: unitMappings.id,
    mealieUnitId: unitMappings.mealieUnitId,
    mealieUnitAbbreviation: unitMappings.mealieUnitAbbreviation,
    grocyUnitId: unitMappings.grocyUnitId,
    grocyUnitName: unitMappings.grocyUnitName,
    mealieUnitName: unitMappings.mealieUnitName,
  }).from(unitMappings);
}

function buildUnmappedMealieFoods(
  mealieFoods: MealieFood[],
  existingProductMappings: ProductMappingRow[],
): MealieFood[] {
  const mappedMealieFoodIds = new Set(existingProductMappings.map(mapping => mapping.mealieFoodId));
  return mealieFoods.filter(food => !mappedMealieFoodIds.has(food.id));
}

function buildUnmappedMealieUnits(
  mealieUnits: MealieUnit[],
  existingUnitMappings: UnitMappingRow[],
): MealieUnit[] {
  const mappedMealieUnitIds = new Set(existingUnitMappings.map(mapping => mapping.mealieUnitId));
  return mealieUnits.filter(unit => !mappedMealieUnitIds.has(unit.id));
}

function buildProductSuggestions(
  unmappedMealieFoods: MealieFood[],
  grocyProducts: GrocyProduct[],
  existingProductMappings: ProductMappingRow[],
  existingUnitMappings: UnitMappingRow[],
): ProductsTabData['productSuggestions'] {
  const mappedGrocyProductIds = new Set(existingProductMappings.map(mapping => mapping.grocyProductId));
  const availableGrocyProducts = grocyProducts.filter(product => !mappedGrocyProductIds.has(product.id));
  const suggestions: ProductsTabData['productSuggestions'] = {};

  for (const mealieFood of unmappedMealieFoods) {
    const matches = fuzzyMatch(mealieFood.name, availableGrocyProducts, product => product.name, 0.3, 1);
    if (matches.length === 0) {
      continue;
    }

    const best = matches[0];
    const grocyUnitId = best.item.quIdPurchase;
    const hasMappedUnit = existingUnitMappings.some(mapping => mapping.grocyUnitId === grocyUnitId);

    suggestions[mealieFood.id] = {
      grocyProductId: best.item.id,
      grocyProductName: best.item.name,
      score: Math.round(best.score * 100),
      suggestedUnitId: grocyUnitId && hasMappedUnit ? grocyUnitId : null,
    };
  }

  return suggestions;
}

function buildUnitSuggestions(
  unmappedMealieUnits: MealieUnit[],
  grocyUnits: GrocyUnit[],
  existingUnitMappings: UnitMappingRow[],
): UnitsTabData['unitSuggestions'] {
  const mappedGrocyUnitIds = new Set(existingUnitMappings.map(mapping => mapping.grocyUnitId));
  const availableGrocyUnits = grocyUnits.filter(unit => !mappedGrocyUnitIds.has(unit.id));
  const suggestions: UnitsTabData['unitSuggestions'] = {};

  for (const mealieUnit of unmappedMealieUnits) {
    const nameMatches = fuzzyMatch(mealieUnit.name, availableGrocyUnits, unit => unit.name, 0.3, 1);
    const abbreviationMatches = mealieUnit.abbreviation
      ? fuzzyMatch(mealieUnit.abbreviation, availableGrocyUnits, unit => unit.name, 0.4, 1)
      : [];
    const best = [...nameMatches, ...abbreviationMatches].sort((left, right) => right.score - left.score)[0];

    if (!best) {
      continue;
    }

    suggestions[mealieUnit.id] = {
      grocyUnitId: best.item.id,
      grocyUnitName: best.item.name,
      score: Math.round(best.score * 100),
    };
  }

  return suggestions;
}

function buildUnmappedGrocyMinStockProducts(
  grocyProducts: GrocyProduct[],
  existingProductMappings: ProductMappingRow[],
  stockByProductId: Map<number, number>,
  missingProductIds: Set<number>,
): GrocyMinStockProduct[] {
  const mappedGrocyProductIds = new Set(existingProductMappings.map(mapping => mapping.grocyProductId));
  return grocyProducts
    .filter(product => product.minStockAmount > 0 && !mappedGrocyProductIds.has(product.id))
    .map(product => ({
      ...product,
      currentStock: stockByProductId.get(product.id) ?? 0,
      isBelowMinimum: missingProductIds.has(product.id),
    }));
}

function buildLowStockGrocyProductSuggestions(
  unmappedGrocyMinStockProducts: GrocyMinStockProduct[],
  unmappedMealieFoods: MealieFood[],
): GrocyMinStockTabData['lowStockGrocyProductSuggestions'] {
  const suggestions: GrocyMinStockTabData['lowStockGrocyProductSuggestions'] = {};

  for (const grocyProduct of unmappedGrocyMinStockProducts) {
    const matches = fuzzyMatch(grocyProduct.name, unmappedMealieFoods, food => food.name, 0.3, 1);
    if (matches.length === 0) {
      continue;
    }

    const best = matches[0];
    suggestions[String(grocyProduct.id)] = {
      mealieFoodId: best.item.id,
      mealieFoodName: best.item.name,
      score: Math.round(best.score * 100),
    };
  }

  return suggestions;
}

function countOrphanGrocyProducts(
  mealieFoods: MealieFood[],
  grocyProducts: GrocyProduct[],
  existingProductMappings: ProductMappingRow[],
): number {
  const mappedGrocyProductIds = new Set(existingProductMappings.map(mapping => mapping.grocyProductId));
  const mealieFoodNames = new Set(mealieFoods.map(food => food.name.toLowerCase()));

  return grocyProducts.filter(product =>
    !mappedGrocyProductIds.has(product.id) && !mealieFoodNames.has(product.name.toLowerCase()),
  ).length;
}

function countOrphanGrocyUnits(
  mealieUnits: MealieUnit[],
  grocyUnits: GrocyUnit[],
  existingUnitMappings: UnitMappingRow[],
): number {
  const mappedGrocyUnitIds = new Set(existingUnitMappings.map(mapping => mapping.grocyUnitId));
  const mealieUnitNames = new Set(mealieUnits.flatMap(unit => [
    unit.name.toLowerCase(),
    unit.abbreviation.toLowerCase(),
  ].filter(Boolean)));

  return grocyUnits.filter(unit =>
    !mappedGrocyUnitIds.has(unit.id) && !mealieUnitNames.has(unit.name.toLowerCase()),
  ).length;
}

async function loadUnitsTabData(): Promise<UnitsTabData> {
  const [mealieUnits, grocyUnits, existingUnitMappings] = await Promise.all([
    fetchMealieUnits(),
    fetchGrocyUnits(),
    fetchExistingUnitMappings(),
  ]);

  const unmappedMealieUnits = buildUnmappedMealieUnits(mealieUnits, existingUnitMappings);

  return {
    mealieUnits,
    unmappedMealieUnits,
    grocyUnits,
    existingUnitMappings,
    unitSuggestions: buildUnitSuggestions(unmappedMealieUnits, grocyUnits, existingUnitMappings),
    orphanGrocyUnitCount: countOrphanGrocyUnits(mealieUnits, grocyUnits, existingUnitMappings),
  };
}

async function loadProductsTabData(): Promise<ProductsTabData> {
  const [mealieFoods, grocyProducts, grocyUnits, existingProductMappings, existingUnitMappings] =
    await Promise.all([
      fetchMealieFoods(),
      fetchGrocyProducts(),
      fetchGrocyUnits(),
      fetchExistingProductMappings(),
      fetchExistingUnitMappings(),
    ]);

  const unmappedMealieFoods = buildUnmappedMealieFoods(mealieFoods, existingProductMappings);

  return {
    unmappedMealieFoods,
    grocyProducts,
    grocyUnits,
    existingUnitMappings,
    productSuggestions: buildProductSuggestions(
      unmappedMealieFoods,
      grocyProducts,
      existingProductMappings,
      existingUnitMappings,
    ),
    orphanGrocyProductCount: countOrphanGrocyProducts(mealieFoods, grocyProducts, existingProductMappings),
  };
}

async function loadGrocyMinStockTabData(): Promise<GrocyMinStockTabData> {
  const [mealieFoods, grocyProducts, grocyUnits, existingProductMappings, stockByProductId, missingProductIds] = await Promise.all([
    fetchMealieFoods(),
    fetchGrocyProducts(),
    fetchGrocyUnits(),
    fetchExistingProductMappings(),
    fetchGrocyCurrentStockByProductId(),
    fetchGrocyMissingProductIds(),
  ]);

  const unmappedMealieFoods = buildUnmappedMealieFoods(mealieFoods, existingProductMappings);
  const unmappedGrocyMinStockProducts = buildUnmappedGrocyMinStockProducts(
    grocyProducts,
    existingProductMappings,
    stockByProductId,
    missingProductIds,
  );

  return {
    unmappedMealieFoods,
    grocyUnits,
    unmappedGrocyMinStockProducts,
    lowStockGrocyProductSuggestions: buildLowStockGrocyProductSuggestions(
      unmappedGrocyMinStockProducts,
      unmappedMealieFoods,
    ),
  };
}

async function loadFullWizardData(): Promise<WizardData> {
  const [mealieFoods, mealieUnits, grocyProducts, grocyUnits, existingProductMappings, existingUnitMappings, stockByProductId, missingProductIds] =
    await Promise.all([
      fetchMealieFoods(),
      fetchMealieUnits(),
      fetchGrocyProducts(),
      fetchGrocyUnits(),
      fetchExistingProductMappings(),
      fetchExistingUnitMappings(),
      fetchGrocyCurrentStockByProductId(),
      fetchGrocyMissingProductIds(),
    ]);

  const unmappedMealieFoods = buildUnmappedMealieFoods(mealieFoods, existingProductMappings);
  const unmappedMealieUnits = buildUnmappedMealieUnits(mealieUnits, existingUnitMappings);
  const unmappedGrocyMinStockProducts = buildUnmappedGrocyMinStockProducts(
    grocyProducts,
    existingProductMappings,
    stockByProductId,
    missingProductIds,
  );

  return {
    unmappedMealieFoods,
    mealieUnits,
    unmappedMealieUnits,
    unmappedGrocyMinStockProducts,
    grocyProducts,
    grocyUnits,
    existingUnitMappings,
    productSuggestions: buildProductSuggestions(
      unmappedMealieFoods,
      grocyProducts,
      existingProductMappings,
      existingUnitMappings,
    ),
    lowStockGrocyProductSuggestions: buildLowStockGrocyProductSuggestions(
      unmappedGrocyMinStockProducts,
      unmappedMealieFoods,
    ),
    unitSuggestions: buildUnitSuggestions(unmappedMealieUnits, grocyUnits, existingUnitMappings),
    orphanGrocyProductCount: countOrphanGrocyProducts(mealieFoods, grocyProducts, existingProductMappings),
    orphanGrocyUnitCount: countOrphanGrocyUnits(mealieUnits, grocyUnits, existingUnitMappings),
  };
}

export async function GET(request: Request) {
  try {
    const tab = new URL(request.url).searchParams.get('tab');

    switch (tab) {
      case 'units':
        return NextResponse.json(await loadUnitsTabData());
      case 'products':
        return NextResponse.json(await loadProductsTabData());
      case 'grocy-min-stock':
        return NextResponse.json(await loadGrocyMinStockTabData());
      default:
        return NextResponse.json(await loadFullWizardData());
    }
  } catch (error) {
    log.error('[MappingWizard] Failed to fetch data:', error);
    return NextResponse.json({ error: 'Failed to fetch mapping data' }, { status: 500 });
  }
}
