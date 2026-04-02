import { db } from '@/lib/db';
import { productMappings } from '@/lib/db/schema';
import {
  getCurrentStock,
  getGrocyEntities,
  getVolatileStock,
  type CurrentStockResponse,
  type GrocyMissingProduct,
  type Location,
  type Product,
  type ProductGroup,
  type QuantityUnit,
  type QuantityUnitConversion,
} from '@/lib/grocy/types';
import {
  RecipesFoodsService,
} from '@/lib/mealie';
import { extractFoods, type MealieFood } from '@/lib/mealie/types';
import {
  normalizeMatchText,
  rankVariantMatches,
  type MatchVariant,
} from '@/lib/fuzzy-match';

export interface ProductMappingRecord {
  id: string;
  mealieFoodId: string;
  mealieFoodName: string;
  grocyProductId: number;
  grocyProductName: string;
  unitMappingId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSearchParams {
  query: string;
  maxResults?: number;
}

export interface ProductOverviewParams {
  productRef: string;
}

export interface ProductDuplicateCheckParams {
  name: string;
  maxFuzzyResults?: number;
}

export interface ProductSearchMatch {
  productRef: string;
  source: 'mapping' | 'grocy' | 'mealie';
  score: number;
  label: string;
  mappingId: string | null;
  mealieFoodId: string | null;
  mealieFoodName: string | null;
  grocyProductId: number | null;
  grocyProductName: string | null;
}

export interface ProductSearchResult {
  query: string;
  matches: ProductSearchMatch[];
}

export interface ProductOverviewMapping {
  id: string;
  mealieFoodId: string;
  mealieFoodName: string;
  grocyProductId: number;
  grocyProductName: string;
  unitMappingId: string | null;
}

export interface GrocyProductOverview {
  id: number;
  name: string;
  quIdPurchase: number | null;
  quIdPurchaseName: string | null;
  quIdStock: number | null;
  quIdStockName: string | null;
  minStockAmount: number;
  currentStock: number;
  isBelowMinimum: boolean;
  treatOpenedAsOutOfStock: boolean;
  defaultBestBeforeDays: number | null;
  defaultBestBeforeDaysAfterOpen: number | null;
  defaultBestBeforeDaysAfterFreezing: number | null;
  defaultBestBeforeDaysAfterThawing: number | null;
  dueType: 'best_before' | 'expiration' | null;
  shouldNotBeFrozen: boolean;
  locationId: number | null;
  locationName: string | null;
  productGroupId: number | null;
  productGroupName: string | null;
  moveOnOpen: boolean;
  defaultConsumeLocationId: number | null;
  defaultConsumeLocationName: string | null;
}

export interface MealieFoodOverview {
  id: string;
  name: string;
  pluralName: string | null;
  aliases: string[];
}

export interface ProductConversion {
  id: number;
  fromUnitId: number;
  fromUnitName: string;
  toUnitId: number;
  toUnitName: string;
  factor: number;
  grocyProductId: number | null;
}

export interface ProductOverview {
  productRef: string;
  mapping: ProductOverviewMapping | null;
  grocyProduct: GrocyProductOverview | null;
  mealieFood: MealieFoodOverview | null;
  conversions: ProductConversion[];
}

export interface ProductDuplicateMatch<TId extends string | number> {
  productRef: string;
  source: 'grocy' | 'mealie';
  score: number;
  id: TId;
  name: string;
  mappingId: string | null;
  mapped: boolean;
  matchedText?: string;
}

export interface ProductDuplicateCheckResult {
  query: string;
  likelyDuplicates: boolean;
  exactGrocyMatches: ProductDuplicateMatch<number>[];
  exactMealieMatches: ProductDuplicateMatch<string>[];
  fuzzyGrocyMatches: ProductDuplicateMatch<number>[];
  fuzzyMealieMatches: ProductDuplicateMatch<string>[];
}

interface NormalizedMealieFood {
  id: string;
  name: string;
  pluralName: string | null;
  aliases: string[];
}

type MealieFoodInput = NormalizedMealieFood | MealieFood;

interface SearchCandidate {
  productRef: string;
  source: 'mapping' | 'grocy' | 'mealie';
  label: string;
  mappingId: string | null;
  mealieFoodId: string | null;
  mealieFoodName: string | null;
  grocyProductId: number | null;
  grocyProductName: string | null;
  variants: MatchVariant[];
}

interface ProductRefLookup {
  kind: 'mapping' | 'grocy' | 'mealie';
  id: string | number;
}

export interface ProductCatalogDeps {
  listProductMappings(): Promise<ProductMappingRecord[]>;
  listGrocyProducts(): Promise<Product[]>;
  listMealieFoods(): Promise<MealieFoodInput[]>;
  listGrocyConversions(): Promise<QuantityUnitConversion[]>;
  listGrocyUnits(): Promise<QuantityUnit[]>;
  listGrocyLocations(): Promise<Location[]>;
  listGrocyProductGroups(): Promise<ProductGroup[]>;
  getCurrentStock(): Promise<CurrentStockResponse[]>;
  getVolatileStock(): Promise<{ missing_products?: GrocyMissingProduct[] }>;
}

function parseAliasNames(aliases: Array<{ name?: string | null }> | null | undefined): string[] {
  return (aliases ?? [])
    .map(alias => alias.name?.trim() ?? '')
    .filter(Boolean);
}

function normalizeMealieFoods(foods: MealieFood[]): NormalizedMealieFood[] {
  return foods
    .filter((food): food is MealieFood & { id: string } => typeof food.id === 'string' && food.id.length > 0)
    .map(food => ({
      id: food.id,
      name: food.name || 'Unknown',
      pluralName: food.pluralName || null,
      aliases: parseAliasNames(food.aliases),
    }));
}

function normalizeMealieFoodRecord(food: MealieFoodInput): NormalizedMealieFood {
  if (Array.isArray((food as NormalizedMealieFood).aliases) && typeof (food as NormalizedMealieFood).aliases[0] === 'string') {
    const normalized = food as NormalizedMealieFood;
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

const defaultDeps: ProductCatalogDeps = {
  listProductMappings: async () => db.select().from(productMappings),
  listGrocyProducts: async () => getGrocyEntities('products'),
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
  listGrocyConversions: async () => getGrocyEntities('quantity_unit_conversions'),
  listGrocyUnits: async () => getGrocyEntities('quantity_units'),
  listGrocyLocations: async () => getGrocyEntities('locations'),
  listGrocyProductGroups: async () => getGrocyEntities('product_groups'),
  getCurrentStock,
  getVolatileStock,
};

function createSearchCandidateVariants(foodName: string | null, grocyName: string | null, aliases: string[] = [], pluralName?: string | null): MatchVariant[] {
  const variants: MatchVariant[] = [];

  if (foodName) {
    variants.push({ text: foodName, kind: 'mealie-name', weight: 1 });
  }

  if (pluralName) {
    variants.push({ text: pluralName, kind: 'mealie-plural', weight: 0.9 });
  }

  for (const alias of aliases) {
    variants.push({ text: alias, kind: 'mealie-alias', weight: 0.95 });
  }

  if (grocyName) {
    variants.push({ text: grocyName, kind: 'grocy-name', weight: 1 });
  }

  return variants;
}

function roundScore(score: number): number {
  return Math.round(score * 100);
}

function parseProductRef(productRef: string): ProductRefLookup {
  const trimmedRef = productRef.trim();

  if (trimmedRef.startsWith('mapping:')) {
    return { kind: 'mapping', id: trimmedRef.slice('mapping:'.length) };
  }

  if (trimmedRef.startsWith('grocy:')) {
    const id = Number(trimmedRef.slice('grocy:'.length));
    if (!Number.isInteger(id)) {
      throw new Error(`Invalid Grocy product ref: ${productRef}`);
    }

    return { kind: 'grocy', id };
  }

  if (trimmedRef.startsWith('mealie:')) {
    return { kind: 'mealie', id: trimmedRef.slice('mealie:'.length) };
  }

  if (/^\d+$/.test(trimmedRef)) {
    const id = Number(trimmedRef);
    if (!Number.isInteger(id)) {
      throw new Error(`Invalid Grocy product ref: ${productRef}`);
    }

    return { kind: 'grocy', id };
  }

  throw new Error(
    `Invalid product ref: ${productRef}. Use mapping:<id>, grocy:<id>, mealie:<id>, or a raw Grocy numeric id. Search by name with products.search first.`,
  );
}

function toCanonicalProductRef(ref: ProductRefLookup): string {
  switch (ref.kind) {
    case 'mapping':
      return `mapping:${ref.id}`;
    case 'grocy':
      return `grocy:${ref.id}`;
    case 'mealie':
      return `mealie:${ref.id}`;
  }
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

function toProductOverviewMapping(mapping: ProductMappingRecord | null): ProductOverviewMapping | null {
  if (!mapping) {
    return null;
  }

  return {
    id: mapping.id,
    mealieFoodId: mapping.mealieFoodId,
    mealieFoodName: mapping.mealieFoodName,
    grocyProductId: mapping.grocyProductId,
    grocyProductName: mapping.grocyProductName,
    unitMappingId: mapping.unitMappingId,
  };
}

function toGrocyProductOverview(
  grocyProduct: Product | undefined,
  currentStockByProductId: Map<number, number>,
  belowMinimumIds: Set<number>,
  locationNameById: Map<number, string>,
  groupNameById: Map<number, string>,
  unitNameById: Map<number, string>,
): GrocyProductOverview | null {
  if (!grocyProduct?.id) {
    return null;
  }

  const productId = Number(grocyProduct.id);
  const locId = grocyProduct.location_id ?? null;
  const grpId = grocyProduct.product_group_id ?? null;
  const quIdPurch = grocyProduct.qu_id_purchase ?? null;
  const quIdStk = grocyProduct.qu_id_stock ?? null;

  const extendedProduct = grocyProduct as Product & {
    default_best_before_days_after_freezing?: number | null;
    default_best_before_days_after_thawing?: number | null;
    due_type?: number | null;
  };

  const consumeLocId = grocyProduct.default_consume_location_id ?? null;

  return {
    id: productId,
    name: grocyProduct.name || 'Unknown',
    quIdPurchase: quIdPurch,
    quIdPurchaseName: quIdPurch !== null ? (unitNameById.get(quIdPurch) ?? null) : null,
    quIdStock: quIdStk,
    quIdStockName: quIdStk !== null ? (unitNameById.get(quIdStk) ?? null) : null,
    minStockAmount: Number(grocyProduct.min_stock_amount ?? 0),
    currentStock: currentStockByProductId.get(productId) ?? 0,
    isBelowMinimum: belowMinimumIds.has(productId),
    treatOpenedAsOutOfStock: Boolean(grocyProduct.treat_opened_as_out_of_stock),
    defaultBestBeforeDays: grocyProduct.default_best_before_days ?? null,
    defaultBestBeforeDaysAfterOpen: grocyProduct.default_best_before_days_after_open ?? null,
    defaultBestBeforeDaysAfterFreezing: extendedProduct.default_best_before_days_after_freezing ?? null,
    defaultBestBeforeDaysAfterThawing: extendedProduct.default_best_before_days_after_thawing ?? null,
    dueType: extendedProduct.due_type === 2
      ? 'expiration'
      : extendedProduct.due_type === 1
        ? 'best_before'
        : null,
    shouldNotBeFrozen: Boolean(grocyProduct.should_not_be_frozen),
    locationId: locId,
    locationName: locId !== null ? (locationNameById.get(locId) ?? null) : null,
    productGroupId: grpId,
    productGroupName: grpId !== null ? (groupNameById.get(grpId) ?? null) : null,
    moveOnOpen: Boolean(grocyProduct.move_on_open),
    defaultConsumeLocationId: consumeLocId,
    defaultConsumeLocationName: consumeLocId !== null ? (locationNameById.get(consumeLocId) ?? null) : null,
  };
}

function toMealieFoodOverview(food: NormalizedMealieFood | undefined): MealieFoodOverview | null {
  if (!food) {
    return null;
  }

  return {
    id: food.id,
    name: food.name,
    pluralName: food.pluralName,
    aliases: food.aliases,
  };
}

function buildProductConversions(
  grocyProductId: number,
  grocyProduct: Product | undefined,
  conversions: QuantityUnitConversion[],
  units: QuantityUnit[],
): ProductConversion[] {
  const unitNameMap = new Map(
    units.map(unit => [Number(unit.id ?? 0), unit.name || 'Unknown']),
  );

  const quIdPurchase = grocyProduct?.qu_id_purchase ?? null;
  const quIdStock = grocyProduct?.qu_id_stock ?? null;
  const relevantUnitIds = new Set<number>();
  if (quIdPurchase) relevantUnitIds.add(quIdPurchase);
  if (quIdStock) relevantUnitIds.add(quIdStock);

  const relevant = conversions.filter(c => {
    const fromId = Number(c.from_qu_id ?? 0);
    const toId = Number(c.to_qu_id ?? 0);
    const productId = c.product_id != null ? Number(c.product_id) : null;

    if (productId === grocyProductId) {
      return true;
    }

    if (productId !== null) {
      return false;
    }

    return relevantUnitIds.has(fromId) || relevantUnitIds.has(toId);
  });

  return relevant.map(c => {
    const fromUnitId = Number(c.from_qu_id ?? 0);
    const toUnitId = Number(c.to_qu_id ?? 0);

    return {
      id: Number(c.id ?? 0),
      fromUnitId,
      fromUnitName: unitNameMap.get(fromUnitId) ?? 'Unknown',
      toUnitId,
      toUnitName: unitNameMap.get(toUnitId) ?? 'Unknown',
      factor: Number(c.factor ?? 0),
      grocyProductId: c.product_id != null ? Number(c.product_id) : null,
    };
  });
}

function getExactVariantMatch(query: string, candidateVariants: MatchVariant[]): string | null {
  const normalizedQuery = normalizeMatchText(query);

  for (const variant of candidateVariants) {
    if (normalizeMatchText(variant.text) === normalizedQuery) {
      return variant.text;
    }
  }

  return null;
}

function buildSearchCandidates(
  mappings: ProductMappingRecord[],
  grocyProducts: Product[],
  mealieFoods: NormalizedMealieFood[],
): SearchCandidate[] {
  const candidates: SearchCandidate[] = [];
  const mappedGrocyIds = new Set(mappings.map(mapping => mapping.grocyProductId));
  const mappedMealieIds = new Set(mappings.map(mapping => mapping.mealieFoodId));
  const mealieById = new Map(mealieFoods.map(food => [food.id, food]));
  const grocyById = new Map(grocyProducts.filter((product): product is Product & { id: number } => typeof product.id === 'number')
    .map(product => [product.id, product]));

  for (const mapping of mappings) {
    const mealieFood = mealieById.get(mapping.mealieFoodId);
    const grocyProduct = grocyById.get(mapping.grocyProductId);

    candidates.push({
      productRef: `mapping:${mapping.id}`,
      source: 'mapping',
      label: `${mapping.mealieFoodName} <-> ${mapping.grocyProductName}`,
      mappingId: mapping.id,
      mealieFoodId: mapping.mealieFoodId,
      mealieFoodName: mapping.mealieFoodName,
      grocyProductId: mapping.grocyProductId,
      grocyProductName: mapping.grocyProductName,
      variants: createSearchCandidateVariants(
        mapping.mealieFoodName,
        mapping.grocyProductName,
        mealieFood?.aliases ?? [],
        mealieFood?.pluralName ?? null,
      ),
    });
  }

  for (const product of grocyProducts) {
    if (!product.id || mappedGrocyIds.has(Number(product.id))) {
      continue;
    }

    candidates.push({
      productRef: `grocy:${product.id}`,
      source: 'grocy',
      label: product.name || 'Unknown',
      mappingId: null,
      mealieFoodId: null,
      mealieFoodName: null,
      grocyProductId: Number(product.id),
      grocyProductName: product.name || 'Unknown',
      variants: createSearchCandidateVariants(null, product.name || 'Unknown'),
    });
  }

  for (const food of mealieFoods) {
    if (mappedMealieIds.has(food.id)) {
      continue;
    }

    candidates.push({
      productRef: `mealie:${food.id}`,
      source: 'mealie',
      label: food.name,
      mappingId: null,
      mealieFoodId: food.id,
      mealieFoodName: food.name,
      grocyProductId: null,
      grocyProductName: null,
      variants: createSearchCandidateVariants(food.name, null, food.aliases, food.pluralName),
    });
  }

  return candidates;
}

export async function searchProducts(
  params: ProductSearchParams,
  deps: ProductCatalogDeps = defaultDeps,
): Promise<ProductSearchResult> {
  const query = params.query.trim();
  if (!query) {
    throw new Error('Query must not be empty.');
  }

  const [mappings, grocyProducts, mealieFoods] = await Promise.all([
    deps.listProductMappings(),
    deps.listGrocyProducts(),
    deps.listMealieFoods(),
  ]);
  const normalizedMealieFoods = mealieFoods.map(normalizeMealieFoodRecord);

  const matches = rankVariantMatches(
    [{ text: query }],
    buildSearchCandidates(mappings, grocyProducts, normalizedMealieFoods),
    candidate => candidate.variants,
    0.3,
    params.maxResults ?? 10,
  );

  return {
    query,
    matches: matches.map(match => ({
      productRef: match.item.productRef,
      source: match.item.source,
      score: roundScore(match.score),
      label: match.item.label,
      mappingId: match.item.mappingId,
      mealieFoodId: match.item.mealieFoodId,
      mealieFoodName: match.item.mealieFoodName,
      grocyProductId: match.item.grocyProductId,
      grocyProductName: match.item.grocyProductName,
    })),
  };
}

export async function getProductOverview(
  params: ProductOverviewParams,
  deps: ProductCatalogDeps = defaultDeps,
): Promise<ProductOverview> {
  const parsedRef = parseProductRef(params.productRef);
  const [mappings, grocyProducts, mealieFoods, currentStock, volatileStock, conversions, units, locations, productGroups] = await Promise.all([
    deps.listProductMappings(),
    deps.listGrocyProducts(),
    deps.listMealieFoods(),
    deps.getCurrentStock(),
    deps.getVolatileStock(),
    deps.listGrocyConversions(),
    deps.listGrocyUnits(),
    deps.listGrocyLocations(),
    deps.listGrocyProductGroups(),
  ]);
  const normalizedMealieFoods = mealieFoods.map(normalizeMealieFoodRecord);
  const canonicalProductRef = toCanonicalProductRef(parsedRef);
  const locationNameById = new Map(locations.map((l: Location) => [Number(l.id), l.name || 'Unknown']));
  const groupNameById = new Map(productGroups.map((g: ProductGroup) => [Number(g.id), g.name || 'Unknown']));

  let mapping: ProductMappingRecord | null = null;

  switch (parsedRef.kind) {
    case 'mapping':
      mapping = mappings.find(candidate => candidate.id === parsedRef.id) ?? null;
      break;
    case 'grocy':
      mapping = mappings.find(candidate => candidate.grocyProductId === parsedRef.id) ?? null;
      break;
    case 'mealie':
      mapping = mappings.find(candidate => candidate.mealieFoodId === parsedRef.id) ?? null;
      break;
  }

  const grocyProductId = parsedRef.kind === 'grocy'
    ? Number(parsedRef.id)
    : mapping?.grocyProductId ?? null;
  const mealieFoodId = parsedRef.kind === 'mealie'
    ? String(parsedRef.id)
    : mapping?.mealieFoodId ?? null;

  const grocyProduct = grocyProductId === null
    ? undefined
    : grocyProducts.find(candidate => Number(candidate.id) === grocyProductId);
  const mealieFood = mealieFoodId === null
    ? undefined
    : normalizedMealieFoods.find(candidate => candidate.id === mealieFoodId);

  if (!mapping && !grocyProduct && !mealieFood) {
    throw new Error(`Unknown product ref: ${params.productRef}`);
  }

  const relevantConversions = grocyProductId === null
    ? []
    : buildProductConversions(grocyProductId, grocyProduct, conversions, units);

  const unitNameById = new Map(units.map(u => [Number(u.id), u.name || 'Unknown']));

  return {
    productRef: canonicalProductRef,
    mapping: toProductOverviewMapping(mapping),
    grocyProduct: toGrocyProductOverview(
      grocyProduct,
      buildCurrentStockMap(currentStock),
      buildBelowMinimumSet(volatileStock.missing_products),
      locationNameById,
      groupNameById,
      unitNameById,
    ),
    mealieFood: toMealieFoodOverview(mealieFood),
    conversions: relevantConversions,
  };
}

export async function checkProductDuplicates(
  params: ProductDuplicateCheckParams,
  deps: ProductCatalogDeps = defaultDeps,
): Promise<ProductDuplicateCheckResult> {
  const query = params.name.trim();
  if (!query) {
    throw new Error('Name must not be empty.');
  }

  const [mappings, grocyProducts, mealieFoods] = await Promise.all([
    deps.listProductMappings(),
    deps.listGrocyProducts(),
    deps.listMealieFoods(),
  ]);
  const normalizedMealieFoods = mealieFoods.map(normalizeMealieFoodRecord);

  const mappingByGrocyId = new Map(mappings.map(mapping => [mapping.grocyProductId, mapping.id]));
  const mappingByMealieId = new Map(mappings.map(mapping => [mapping.mealieFoodId, mapping.id]));

  const exactGrocyMatches = grocyProducts
    .filter(product => Boolean(getExactVariantMatch(query, createSearchCandidateVariants(null, product.name || 'Unknown'))))
    .map(product => ({
      productRef: `grocy:${product.id}`,
      source: 'grocy' as const,
      score: 100,
      id: Number(product.id),
      name: product.name || 'Unknown',
      mappingId: product.id ? (mappingByGrocyId.get(Number(product.id)) ?? null) : null,
      mapped: product.id ? mappingByGrocyId.has(Number(product.id)) : false,
    }));

  const exactMealieMatches = normalizedMealieFoods
    .filter(food => Boolean(getExactVariantMatch(query, createSearchCandidateVariants(food.name, null, food.aliases, food.pluralName))))
    .map(food => ({
      productRef: `mealie:${food.id}`,
      source: 'mealie' as const,
      score: 100,
      id: food.id,
      name: food.name,
      mappingId: mappingByMealieId.get(food.id) ?? null,
      mapped: mappingByMealieId.has(food.id),
    }));

  const exactGrocyIds = new Set(exactGrocyMatches.map(match => match.id));
  const exactMealieIds = new Set(exactMealieMatches.map(match => match.id));

  const fuzzyGrocyMatches = rankVariantMatches(
    [{ text: query }],
    grocyProducts.filter(product => product.id && !exactGrocyIds.has(Number(product.id))),
    product => createSearchCandidateVariants(null, product.name || 'Unknown'),
    0.5,
    params.maxFuzzyResults ?? 5,
  ).map(match => ({
    productRef: `grocy:${match.item.id}`,
    source: 'grocy' as const,
    score: roundScore(match.score),
    id: Number(match.item.id),
    name: match.item.name || 'Unknown',
    mappingId: match.item.id ? (mappingByGrocyId.get(Number(match.item.id)) ?? null) : null,
    mapped: match.item.id ? mappingByGrocyId.has(Number(match.item.id)) : false,
    matchedText: match.text,
  }));

  const fuzzyMealieMatches = rankVariantMatches(
    [{ text: query }],
    normalizedMealieFoods.filter(food => !exactMealieIds.has(food.id)),
    food => createSearchCandidateVariants(food.name, null, food.aliases, food.pluralName),
    0.5,
    params.maxFuzzyResults ?? 5,
  ).map(match => ({
    productRef: `mealie:${match.item.id}`,
    source: 'mealie' as const,
    score: roundScore(match.score),
    id: match.item.id,
    name: match.item.name,
    mappingId: mappingByMealieId.get(match.item.id) ?? null,
    mapped: mappingByMealieId.has(match.item.id),
    matchedText: match.text,
  }));

  return {
    query,
    likelyDuplicates: exactGrocyMatches.length > 0
      || exactMealieMatches.length > 0
      || fuzzyGrocyMatches.length > 0
      || fuzzyMealieMatches.length > 0,
    exactGrocyMatches,
    exactMealieMatches,
    fuzzyGrocyMatches,
    fuzzyMealieMatches,
  };
}
