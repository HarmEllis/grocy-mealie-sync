import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getCurrentStock, getGrocyEntities, getVolatileStock } from '@/lib/grocy/types';
import { RecipesFoodsService, RecipesUnitsService } from '@/lib/mealie';
import { extractFoods, extractUnits } from '@/lib/mealie/types';
import { findSuggestedMatch, type MatchVariant } from '@/lib/fuzzy-match';
import { log } from '@/lib/logger';
import { resolveMappingWizardMinStockStep } from '@/lib/settings';
import { filterActiveUnitMappings } from '@/lib/active-unit-mappings';
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

interface SuggestibleMealieFood extends MealieFood {
  pluralName: string;
  aliases: string[];
}

interface SuggestibleMealieUnit extends MealieUnit {
  pluralName: string;
  pluralAbbreviation: string;
  aliases: string[];
}

interface SuggestibleGrocyUnit extends GrocyUnit {
  pluralName: string;
  pluralForms: string[];
}

function parseAliasNames(aliases: Array<{ name?: string | null }> | null | undefined): string[] {
  return (aliases ?? [])
    .map(alias => alias.name?.trim() ?? '')
    .filter(Boolean);
}

function parsePluralForms(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/[,\n;|]/)
    .map(part => part.trim())
    .filter(Boolean);
}

function roundSuggestionScore(score: number): number {
  return Math.round(score * 100);
}

function toPublicMealieFoods(foods: SuggestibleMealieFood[]): MealieFood[] {
  return foods.map(food => ({
    id: food.id,
    name: food.name,
  }));
}

function toPublicMealieUnits(units: SuggestibleMealieUnit[]): MealieUnit[] {
  return units.map(unit => ({
    id: unit.id,
    name: unit.name,
    abbreviation: unit.abbreviation,
  }));
}

function toPublicGrocyUnits(units: SuggestibleGrocyUnit[]): GrocyUnit[] {
  return units.map(unit => ({
    id: unit.id,
    name: unit.name,
  }));
}

function buildFoodVariants(food: Pick<SuggestibleMealieFood, 'name' | 'pluralName' | 'aliases'>): MatchVariant[] {
  return [
    { text: food.name, kind: 'name', weight: 1 },
    { text: food.pluralName, kind: 'plural', weight: 1 },
    ...food.aliases.map(alias => ({ text: alias, kind: 'alias', weight: 1 })),
  ];
}

function buildUnitVariants(unit: Pick<SuggestibleMealieUnit, 'name' | 'pluralName' | 'abbreviation' | 'pluralAbbreviation' | 'aliases'>): MatchVariant[] {
  return [
    { text: unit.name, kind: 'name', weight: 1 },
    { text: unit.pluralName, kind: 'plural', weight: 1 },
    { text: unit.abbreviation, kind: 'abbreviation', weight: 1 },
    { text: unit.pluralAbbreviation, kind: 'plural-abbreviation', weight: 1 },
    ...unit.aliases.map(alias => ({ text: alias, kind: 'alias', weight: 1 })),
  ];
}

function buildGrocyUnitVariants(unit: Pick<SuggestibleGrocyUnit, 'name' | 'pluralName' | 'pluralForms'>): MatchVariant[] {
  return [
    { text: unit.name, kind: 'name', weight: 1 },
    { text: unit.pluralName, kind: 'plural', weight: 1 },
    ...unit.pluralForms.map(form => ({ text: form, kind: 'plural-form', weight: 1 })),
  ];
}

async function fetchMealieFoods(): Promise<SuggestibleMealieFood[]> {
  const mealieFoodsRes = await RecipesFoodsService.getAllApiFoodsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
  );

  return extractFoods(mealieFoodsRes)
    .filter(food => food.id)
    .map(food => ({
      id: food.id,
      name: food.name || 'Unknown',
      pluralName: food.pluralName || '',
      aliases: parseAliasNames(food.aliases),
    }));
}

async function fetchMealieUnits(): Promise<SuggestibleMealieUnit[]> {
  const mealieUnitsRes = await RecipesUnitsService.getAllApiUnitsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
  );

  return extractUnits(mealieUnitsRes)
    .filter(unit => unit.id)
    .map(unit => ({
      id: unit.id,
      name: unit.name || 'Unknown',
      abbreviation: unit.abbreviation || '',
      pluralName: unit.pluralName || '',
      pluralAbbreviation: unit.pluralAbbreviation || '',
      aliases: parseAliasNames(unit.aliases),
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

async function fetchGrocyUnits(): Promise<SuggestibleGrocyUnit[]> {
  const grocyUnits = await getGrocyEntities('quantity_units');
  return grocyUnits.map(unit => ({
    id: Number(unit.id),
    name: unit.name || 'Unknown',
    pluralName: unit.name_plural || '',
    pluralForms: parsePluralForms(unit.plural_forms),
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
  mealieFoods: SuggestibleMealieFood[],
  existingProductMappings: ProductMappingRow[],
): SuggestibleMealieFood[] {
  const mappedMealieFoodIds = new Set(existingProductMappings.map(mapping => mapping.mealieFoodId));
  return mealieFoods.filter(food => !mappedMealieFoodIds.has(food.id));
}

function buildUnmappedMealieUnits(
  mealieUnits: SuggestibleMealieUnit[],
  existingUnitMappings: UnitMappingRow[],
): SuggestibleMealieUnit[] {
  const mappedMealieUnitIds = new Set(existingUnitMappings.map(mapping => mapping.mealieUnitId));
  return mealieUnits.filter(unit => !mappedMealieUnitIds.has(unit.id));
}

function buildProductSuggestions(
  unmappedMealieFoods: SuggestibleMealieFood[],
  grocyProducts: GrocyProduct[],
  existingProductMappings: ProductMappingRow[],
  existingUnitMappings: UnitMappingRow[],
): ProductsTabData['productSuggestions'] {
  const mappedGrocyProductIds = new Set(existingProductMappings.map(mapping => mapping.grocyProductId));
  const availableGrocyProducts = grocyProducts.filter(product => !mappedGrocyProductIds.has(product.id));
  const suggestions: ProductsTabData['productSuggestions'] = {};

  for (const mealieFood of unmappedMealieFoods) {
    const match = findSuggestedMatch(
      buildFoodVariants(mealieFood),
      availableGrocyProducts,
      product => [{ text: product.name, kind: 'name', weight: 1 }],
    );
    if (!match.best) {
      continue;
    }

    const grocyUnitId = match.best.item.quIdPurchase;
    const hasMappedUnit = existingUnitMappings.some(mapping => mapping.grocyUnitId === grocyUnitId);

    suggestions[mealieFood.id] = {
      grocyProductId: match.best.item.id,
      grocyProductName: match.best.item.name,
      score: roundSuggestionScore(match.best.score),
      suggestedUnitId: grocyUnitId && hasMappedUnit ? grocyUnitId : null,
      ambiguous: match.ambiguous,
      runnerUp: match.runnerUp ? {
        id: match.runnerUp.item.id,
        name: match.runnerUp.item.name,
        score: roundSuggestionScore(match.runnerUp.score),
      } : null,
    };
  }

  return suggestions;
}

function buildUnitSuggestions(
  unmappedMealieUnits: SuggestibleMealieUnit[],
  grocyUnits: SuggestibleGrocyUnit[],
  existingUnitMappings: UnitMappingRow[],
): UnitsTabData['unitSuggestions'] {
  const mappedGrocyUnitIds = new Set(existingUnitMappings.map(mapping => mapping.grocyUnitId));
  const availableGrocyUnits = grocyUnits.filter(unit => !mappedGrocyUnitIds.has(unit.id));
  const suggestions: UnitsTabData['unitSuggestions'] = {};

  for (const mealieUnit of unmappedMealieUnits) {
    const match = findSuggestedMatch(
      buildUnitVariants(mealieUnit),
      availableGrocyUnits,
      buildGrocyUnitVariants,
    );

    if (!match.best) {
      continue;
    }

    suggestions[mealieUnit.id] = {
      grocyUnitId: match.best.item.id,
      grocyUnitName: match.best.item.name,
      score: roundSuggestionScore(match.best.score),
      ambiguous: match.ambiguous,
      runnerUp: match.runnerUp ? {
        id: match.runnerUp.item.id,
        name: match.runnerUp.item.name,
        score: roundSuggestionScore(match.runnerUp.score),
      } : null,
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
  unmappedMealieFoods: SuggestibleMealieFood[],
): GrocyMinStockTabData['lowStockGrocyProductSuggestions'] {
  const suggestions: GrocyMinStockTabData['lowStockGrocyProductSuggestions'] = {};

  for (const grocyProduct of unmappedGrocyMinStockProducts) {
    const match = findSuggestedMatch(
      [{ text: grocyProduct.name, kind: 'name', weight: 1 }],
      unmappedMealieFoods,
      buildFoodVariants,
    );
    if (!match.best) {
      continue;
    }

    suggestions[String(grocyProduct.id)] = {
      mealieFoodId: match.best.item.id,
      mealieFoodName: match.best.item.name,
      score: roundSuggestionScore(match.best.score),
      ambiguous: match.ambiguous,
      runnerUp: match.runnerUp ? {
        id: match.runnerUp.item.id,
        name: match.runnerUp.item.name,
        score: roundSuggestionScore(match.runnerUp.score),
      } : null,
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
  const activeUnitMappings = filterActiveUnitMappings(existingUnitMappings, mealieUnits, grocyUnits);

  const unmappedMealieUnits = buildUnmappedMealieUnits(mealieUnits, activeUnitMappings);

  return {
    mealieUnits: toPublicMealieUnits(mealieUnits),
    unmappedMealieUnits: toPublicMealieUnits(unmappedMealieUnits),
    grocyUnits: toPublicGrocyUnits(grocyUnits),
    existingUnitMappings: activeUnitMappings,
    unitSuggestions: buildUnitSuggestions(unmappedMealieUnits, grocyUnits, activeUnitMappings),
    orphanGrocyUnitCount: countOrphanGrocyUnits(mealieUnits, grocyUnits, activeUnitMappings),
  };
}

async function loadProductsTabData(): Promise<ProductsTabData> {
  const [mealieFoods, mealieUnits, grocyProducts, grocyUnits, existingProductMappings, existingUnitMappings] =
    await Promise.all([
      fetchMealieFoods(),
      fetchMealieUnits(),
      fetchGrocyProducts(),
      fetchGrocyUnits(),
      fetchExistingProductMappings(),
      fetchExistingUnitMappings(),
    ]);
  const activeUnitMappings = filterActiveUnitMappings(existingUnitMappings, mealieUnits, grocyUnits);

  const unmappedMealieFoods = buildUnmappedMealieFoods(mealieFoods, existingProductMappings);

  return {
    unmappedMealieFoods: toPublicMealieFoods(unmappedMealieFoods),
    grocyProducts,
    grocyUnits: toPublicGrocyUnits(grocyUnits),
    existingUnitMappings: activeUnitMappings,
    productSuggestions: buildProductSuggestions(
      unmappedMealieFoods,
      grocyProducts,
      existingProductMappings,
      activeUnitMappings,
    ),
    orphanGrocyProductCount: countOrphanGrocyProducts(mealieFoods, grocyProducts, existingProductMappings),
  };
}

async function loadGrocyMinStockTabData(): Promise<GrocyMinStockTabData> {
  const [mealieFoods, grocyProducts, grocyUnits, existingProductMappings, stockByProductId, missingProductIds, minStockStep] = await Promise.all([
    fetchMealieFoods(),
    fetchGrocyProducts(),
    fetchGrocyUnits(),
    fetchExistingProductMappings(),
    fetchGrocyCurrentStockByProductId(),
    fetchGrocyMissingProductIds(),
    resolveMappingWizardMinStockStep(),
  ]);

  const unmappedMealieFoods = buildUnmappedMealieFoods(mealieFoods, existingProductMappings);
  const unmappedGrocyMinStockProducts = buildUnmappedGrocyMinStockProducts(
    grocyProducts,
    existingProductMappings,
    stockByProductId,
    missingProductIds,
  );

  return {
    minStockStep,
    unmappedMealieFoods: toPublicMealieFoods(unmappedMealieFoods),
    grocyUnits: toPublicGrocyUnits(grocyUnits),
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
  const activeUnitMappings = filterActiveUnitMappings(existingUnitMappings, mealieUnits, grocyUnits);

  const unmappedMealieFoods = buildUnmappedMealieFoods(mealieFoods, existingProductMappings);
  const unmappedMealieUnits = buildUnmappedMealieUnits(mealieUnits, activeUnitMappings);
  const unmappedGrocyMinStockProducts = buildUnmappedGrocyMinStockProducts(
    grocyProducts,
    existingProductMappings,
    stockByProductId,
    missingProductIds,
  );

  return {
    unmappedMealieFoods: toPublicMealieFoods(unmappedMealieFoods),
    mealieUnits: toPublicMealieUnits(mealieUnits),
    unmappedMealieUnits: toPublicMealieUnits(unmappedMealieUnits),
    unmappedGrocyMinStockProducts,
    grocyProducts,
    grocyUnits: toPublicGrocyUnits(grocyUnits),
    existingUnitMappings: activeUnitMappings,
    productSuggestions: buildProductSuggestions(
      unmappedMealieFoods,
      grocyProducts,
      existingProductMappings,
      activeUnitMappings,
    ),
    lowStockGrocyProductSuggestions: buildLowStockGrocyProductSuggestions(
      unmappedGrocyMinStockProducts,
      unmappedMealieFoods,
    ),
    unitSuggestions: buildUnitSuggestions(unmappedMealieUnits, grocyUnits, activeUnitMappings),
    orphanGrocyProductCount: countOrphanGrocyProducts(mealieFoods, grocyProducts, existingProductMappings),
    orphanGrocyUnitCount: countOrphanGrocyUnits(mealieUnits, grocyUnits, activeUnitMappings),
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
