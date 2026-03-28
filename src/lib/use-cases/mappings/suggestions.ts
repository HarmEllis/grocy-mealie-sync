import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { findSuggestedMatch, type MatchVariant } from '@/lib/fuzzy-match';
import { getGrocyEntities, type Product, type QuantityUnit } from '@/lib/grocy/types';
import { RecipesFoodsService, RecipesUnitsService } from '@/lib/mealie';
import { extractFoods, extractUnits, type MealieFood, type MealieUnit } from '@/lib/mealie/types';
import type { ProductMappingRecord } from '@/lib/use-cases/products/catalog';
import type { UnitMappingRecord } from '@/lib/use-cases/resources/read-models';

interface SuggestibleMealieFood {
  id: string;
  name: string;
  pluralName: string | null;
  aliases: string[];
}

interface SuggestibleMealieUnit {
  id: string;
  name: string;
  pluralName: string | null;
  abbreviation: string;
  pluralAbbreviation: string | null;
  aliases: string[];
}

interface SuggestibleGrocyProduct {
  id: number;
  name: string;
  quIdPurchase: number | null;
}

interface SuggestibleGrocyUnit {
  id: number;
  name: string;
  pluralName: string | null;
  pluralForms: string[];
}

export interface ProductMappingSuggestion {
  mealieFoodId: string;
  mealieFoodName: string;
  grocyProductId: number;
  grocyProductName: string;
  score: number;
  suggestedUnitId: number | null;
  ambiguous: boolean;
}

export interface SuggestProductMappingsResult {
  count: number;
  suggestions: ProductMappingSuggestion[];
}

export interface UnitMappingSuggestion {
  mealieUnitId: string;
  mealieUnitName: string;
  grocyUnitId: number;
  grocyUnitName: string;
  score: number;
  ambiguous: boolean;
}

export interface SuggestUnitMappingsResult {
  count: number;
  suggestions: UnitMappingSuggestion[];
}

export interface MappingSuggestionDeps {
  listProductMappings(): Promise<ProductMappingRecord[]>;
  listUnitMappings(): Promise<UnitMappingRecord[]>;
  listGrocyProducts(): Promise<Array<Pick<Product, 'id' | 'name' | 'qu_id_purchase'>>>;
  listGrocyUnits(): Promise<Array<Pick<QuantityUnit, 'id' | 'name' | 'name_plural' | 'plural_forms'>>>;
  listMealieFoods(): Promise<Array<SuggestibleMealieFood | MealieFood>>;
  listMealieUnits(): Promise<Array<SuggestibleMealieUnit | MealieUnit>>;
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

function compareByName<T extends { name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name);
}

function normalizeMealieFood(food: SuggestibleMealieFood | MealieFood): SuggestibleMealieFood {
  const normalized = food as SuggestibleMealieFood;
  if (Array.isArray(normalized.aliases) && normalized.aliases.every(alias => typeof alias === 'string')) {
    return {
      id: normalized.id,
      name: normalized.name,
      pluralName: normalized.pluralName ?? null,
      aliases: normalized.aliases,
    };
  }

  const rawFood = food as MealieFood;
  return {
    id: rawFood.id || 'unknown',
    name: rawFood.name || 'Unknown',
    pluralName: rawFood.pluralName || null,
    aliases: parseAliasNames(rawFood.aliases),
  };
}

function normalizeMealieUnit(unit: SuggestibleMealieUnit | MealieUnit): SuggestibleMealieUnit {
  const normalized = unit as SuggestibleMealieUnit;
  if (Array.isArray(normalized.aliases) && normalized.aliases.every(alias => typeof alias === 'string')) {
    return {
      id: normalized.id,
      name: normalized.name,
      pluralName: normalized.pluralName ?? null,
      abbreviation: normalized.abbreviation ?? '',
      pluralAbbreviation: normalized.pluralAbbreviation ?? null,
      aliases: normalized.aliases,
    };
  }

  const rawUnit = unit as MealieUnit;
  return {
    id: rawUnit.id || 'unknown',
    name: rawUnit.name || 'Unknown',
    pluralName: rawUnit.pluralName || null,
    abbreviation: rawUnit.abbreviation || '',
    pluralAbbreviation: rawUnit.pluralAbbreviation || null,
    aliases: parseAliasNames(rawUnit.aliases),
  };
}

function normalizeGrocyProduct(product: Pick<Product, 'id' | 'name' | 'qu_id_purchase'>): SuggestibleGrocyProduct {
  return {
    id: Number(product.id),
    name: product.name || 'Unknown',
    quIdPurchase: product.qu_id_purchase ? Number(product.qu_id_purchase) : null,
  };
}

function normalizeGrocyUnit(unit: Pick<QuantityUnit, 'id' | 'name' | 'name_plural' | 'plural_forms'>): SuggestibleGrocyUnit {
  return {
    id: Number(unit.id),
    name: unit.name || 'Unknown',
    pluralName: unit.name_plural || null,
    pluralForms: parsePluralForms(unit.plural_forms),
  };
}

function buildFoodVariants(food: SuggestibleMealieFood): MatchVariant[] {
  return [
    { text: food.name, kind: 'name', weight: 1 },
    { text: food.pluralName ?? '', kind: 'plural', weight: 1 },
    ...food.aliases.map(alias => ({ text: alias, kind: 'alias', weight: 0.95 })),
  ];
}

function buildGrocyProductVariants(product: SuggestibleGrocyProduct): MatchVariant[] {
  return [
    { text: product.name, kind: 'name', weight: 1 },
  ];
}

function buildUnitVariants(unit: SuggestibleMealieUnit): MatchVariant[] {
  return [
    { text: unit.name, kind: 'name', weight: 1 },
    { text: unit.pluralName ?? '', kind: 'plural', weight: 1 },
    { text: unit.abbreviation, kind: 'abbreviation', weight: 1 },
    { text: unit.pluralAbbreviation ?? '', kind: 'plural-abbreviation', weight: 1 },
    ...unit.aliases.map(alias => ({ text: alias, kind: 'alias', weight: 1 })),
  ];
}

function buildGrocyUnitVariants(unit: SuggestibleGrocyUnit): MatchVariant[] {
  return [
    { text: unit.name, kind: 'name', weight: 1 },
    { text: unit.pluralName ?? '', kind: 'plural', weight: 1 },
    ...unit.pluralForms.map(form => ({ text: form, kind: 'plural-form', weight: 1 })),
  ];
}

const defaultDeps: MappingSuggestionDeps = {
  listProductMappings: async () => db.select().from(productMappings),
  listUnitMappings: async () => db.select().from(unitMappings),
  listGrocyProducts: async () => getGrocyEntities('products'),
  listGrocyUnits: async () => getGrocyEntities('quantity_units'),
  listMealieFoods: async () => extractFoods(await RecipesFoodsService.getAllApiFoodsGet(
    undefined,
    undefined,
    undefined,
    'asc',
    undefined,
    undefined,
    1,
    10000,
  )),
  listMealieUnits: async () => extractUnits(await RecipesUnitsService.getAllApiUnitsGet(
    undefined,
    undefined,
    undefined,
    'asc',
    undefined,
    undefined,
    1,
    1000,
  )),
};

export async function suggestProductMappings(
  deps: MappingSuggestionDeps = defaultDeps,
): Promise<SuggestProductMappingsResult> {
  const [productMappingsData, unitMappingsData, grocyProductsRaw, mealieFoodsRaw] = await Promise.all([
    deps.listProductMappings(),
    deps.listUnitMappings(),
    deps.listGrocyProducts(),
    deps.listMealieFoods(),
  ]);

  const mappedGrocyProductIds = new Set(productMappingsData.map(mapping => mapping.grocyProductId));
  const mappedMealieFoodIds = new Set(productMappingsData.map(mapping => mapping.mealieFoodId));
  const mappedGrocyUnitIds = new Set(unitMappingsData.map(mapping => mapping.grocyUnitId));
  const grocyProducts = grocyProductsRaw
    .map(normalizeGrocyProduct)
    .filter(product => !mappedGrocyProductIds.has(product.id));
  const mealieFoods = mealieFoodsRaw
    .map(normalizeMealieFood)
    .filter(food => !mappedMealieFoodIds.has(food.id));

  const suggestions = mealieFoods
    .map(food => {
      const match = findSuggestedMatch(
        buildFoodVariants(food),
        grocyProducts,
        buildGrocyProductVariants,
      );

      if (!match.best) {
        return null;
      }

      const suggestedUnitId = match.best.item.quIdPurchase && mappedGrocyUnitIds.has(match.best.item.quIdPurchase)
        ? match.best.item.quIdPurchase
        : null;

      return {
        mealieFoodId: food.id,
        mealieFoodName: food.name,
        grocyProductId: match.best.item.id,
        grocyProductName: match.best.item.name,
        score: roundSuggestionScore(match.best.score),
        suggestedUnitId,
        ambiguous: match.ambiguous,
      } satisfies ProductMappingSuggestion;
    })
    .filter((suggestion): suggestion is ProductMappingSuggestion => suggestion !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.mealieFoodName.localeCompare(right.mealieFoodName);
    });

  return {
    count: suggestions.length,
    suggestions,
  };
}

export async function suggestUnitMappings(
  deps: MappingSuggestionDeps = defaultDeps,
): Promise<SuggestUnitMappingsResult> {
  const [unitMappingsData, grocyUnitsRaw, mealieUnitsRaw] = await Promise.all([
    deps.listUnitMappings(),
    deps.listGrocyUnits(),
    deps.listMealieUnits(),
  ]);

  const mappedGrocyUnitIds = new Set(unitMappingsData.map(mapping => mapping.grocyUnitId));
  const mappedMealieUnitIds = new Set(unitMappingsData.map(mapping => mapping.mealieUnitId));
  const grocyUnits = grocyUnitsRaw
    .map(normalizeGrocyUnit)
    .filter(unit => !mappedGrocyUnitIds.has(unit.id))
    .sort(compareByName);
  const mealieUnits = mealieUnitsRaw
    .map(normalizeMealieUnit)
    .filter(unit => !mappedMealieUnitIds.has(unit.id))
    .sort(compareByName);

  const suggestions = mealieUnits
    .map(unit => {
      const match = findSuggestedMatch(
        buildUnitVariants(unit),
        grocyUnits,
        buildGrocyUnitVariants,
      );

      if (!match.best) {
        return null;
      }

      return {
        mealieUnitId: unit.id,
        mealieUnitName: unit.name,
        grocyUnitId: match.best.item.id,
        grocyUnitName: match.best.item.name,
        score: roundSuggestionScore(match.best.score),
        ambiguous: match.ambiguous,
      } satisfies UnitMappingSuggestion;
    })
    .filter((suggestion): suggestion is UnitMappingSuggestion => suggestion !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.mealieUnitName.localeCompare(right.mealieUnitName);
    });

  return {
    count: suggestions.length,
    suggestions,
  };
}
