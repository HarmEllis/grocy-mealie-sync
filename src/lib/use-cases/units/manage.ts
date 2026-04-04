import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import {
  createGrocyEntity,
  deleteGrocyEntity,
  getGrocyEntities,
  updateGrocyEntity,
  type CreateQuantityUnitBody,
  type Product,
  type QuantityUnit,
  type QuantityUnitConversion,
} from '@/lib/grocy/types';
import {
  HouseholdsShoppingListItemsService,
  RecipeCrudService,
  RecipesUnitsService,
} from '@/lib/mealie';
import type { CreateIngredientUnit } from '@/lib/mealie/client/models/CreateIngredientUnit';
import type { IngredientUnit_Output } from '@/lib/mealie/client/models/IngredientUnit_Output';
import type { RecipeIngredient_Output } from '@/lib/mealie/client/models/RecipeIngredient_Output';
import type { Recipe_Output } from '@/lib/mealie/client/models/Recipe_Output';
import type { RecipeSummary } from '@/lib/mealie/client/models/RecipeSummary';
import { extractShoppingItems, extractUnits, type MealieShoppingItem } from '@/lib/mealie/types';
import { normalizeUnits as runUnitNormalization } from '@/lib/sync/normalize';
import { defaultSyncLockDeps, runWithSyncLock, type SyncLockDeps } from '@/lib/use-cases/shared/sync-lock';
import { type UnitMappingRecord } from '@/lib/use-cases/resources/read-models';

export interface UnitCatalogGrocyUnit {
  id: number;
  name: string;
  pluralName: string | null;
  pluralForms: string[];
  mappingId: string | null;
}

export interface UnitCatalogMealieUnit {
  id: string;
  name: string;
  pluralName: string | null;
  abbreviation: string;
  pluralAbbreviation: string | null;
  aliases: string[];
  mappingId: string | null;
}

export interface UnitCatalogResource {
  counts: {
    grocyUnits: number;
    mealieUnits: number;
    mappedUnits: number;
  };
  grocyUnits: UnitCatalogGrocyUnit[];
  mealieUnits: UnitCatalogMealieUnit[];
}

export interface CreateGrocyUnitParams {
  name: string;
  pluralName?: string | null;
  pluralForms?: string[];
  description?: string | null;
}

export interface CreateGrocyUnitResult {
  created: boolean;
  grocyUnitId: number | null;
  grocyUnitName: string | null;
  duplicateCheck: {
    skipped: boolean;
    exactGrocyMatches: number;
  };
}

export interface CreateMealieUnitParams {
  name: string;
  pluralName?: string | null;
  abbreviation?: string;
  pluralAbbreviation?: string | null;
  aliases?: string[];
  description?: string | null;
  fraction?: boolean;
  useAbbreviation?: boolean;
}

export interface CreateMealieUnitResult {
  created: boolean;
  mealieUnitId: string | null;
  mealieUnitName: string | null;
  duplicateCheck: {
    skipped: boolean;
    exactMealieMatches: number;
  };
}

export interface UpdateGrocyUnitMetadataParams {
  grocyUnitId: number;
  name?: string;
  pluralName?: string | null;
  pluralForms?: string[];
  description?: string | null;
}

export interface UpdateGrocyUnitMetadataResult {
  grocyUnitId: number;
  updated: {
    name?: string;
    pluralName?: string | null;
    pluralForms?: string[];
    description?: string | null;
  };
}

export interface UpdateMealieUnitMetadataParams {
  mealieUnitId: string;
  name?: string;
  pluralName?: string | null;
  abbreviation?: string;
  pluralAbbreviation?: string | null;
  aliases?: string[];
}

export interface UpdateMealieUnitMetadataResult {
  mealieUnitId: string;
  updated: {
    name?: string;
    pluralName?: string | null;
    abbreviation?: string;
    pluralAbbreviation?: string | null;
    aliases?: string[];
  };
}

function requireUnitMetadataUpdate(targetLabel: string, updated: Record<string, unknown>) {
  if (Object.keys(updated).length === 0) {
    throw new Error(`Provide at least one field to update the ${targetLabel}.`);
  }
}

export type UnitDeleteBlockerSource =
  | 'unit_mapping'
  | 'grocy_product_purchase_unit'
  | 'grocy_product_stock_unit'
  | 'grocy_conversion_from_unit'
  | 'grocy_conversion_to_unit'
  | 'mealie_shopping_item'
  | 'mealie_recipe';

export interface UnitDeleteBlocker {
  source: UnitDeleteBlockerSource;
  reference: string;
  message: string;
}

export interface DeleteGrocyUnitParams {
  grocyUnitId: number;
}

export interface DeleteGrocyUnitResult {
  deleted: boolean;
  blocked: boolean;
  grocyUnitId: number;
  grocyUnitName: string | null;
  blockers: UnitDeleteBlocker[];
}

export interface DeleteMealieUnitParams {
  mealieUnitId: string;
}

export interface DeleteMealieUnitResult {
  deleted: boolean;
  blocked: boolean;
  mealieUnitId: string;
  mealieUnitName: string | null;
  blockers: UnitDeleteBlocker[];
}

export interface CompareUnitsParams {
  mealieUnitId: string;
  grocyUnitId: number;
}

export interface CompareUnitsResult {
  mealieUnitId: string;
  grocyUnitId: number;
  currentlyMapped: boolean;
  nameMatches: boolean;
  aliasMatches: boolean;
  mealieUnit: UnitCatalogMealieUnit;
  grocyUnit: UnitCatalogGrocyUnit;
  notes: string[];
}

export interface NormalizeMappedUnitsResult {
  normalizedMealie: number;
  normalizedGrocy: number;
  skippedDuplicates: string[];
}

export interface UnitManageDeps extends SyncLockDeps {
  listGrocyUnits(): Promise<QuantityUnit[]>;
  listGrocyProducts(): Promise<Product[]>;
  listGrocyConversions(): Promise<QuantityUnitConversion[]>;
  listMealieUnits(): Promise<IngredientUnit_Output[]>;
  listMealieShoppingItems(): Promise<MealieShoppingItem[]>;
  listMealieRecipeSummaries(): Promise<RecipeSummary[]>;
  listUnitMappings(): Promise<UnitMappingRecord[]>;
  createGrocyUnit(body: CreateQuantityUnitBody): Promise<{ createdObjectId: number }>;
  createMealieUnit(body: CreateIngredientUnit): Promise<IngredientUnit_Output>;
  getGrocyUnit(grocyUnitId: number): Promise<QuantityUnit>;
  updateGrocyUnit(grocyUnitId: number, body: Record<string, unknown>): Promise<void>;
  deleteGrocyUnit(grocyUnitId: number): Promise<void>;
  getMealieUnit(mealieUnitId: string): Promise<IngredientUnit_Output>;
  getMealieRecipe(recipeLookup: string): Promise<Recipe_Output>;
  updateMealieUnit(mealieUnitId: string, body: Record<string, unknown>): Promise<void>;
  deleteMealieUnit(mealieUnitId: string): Promise<void>;
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

function normalizeUnitName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function toUniqueTrimmedNames(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? [])
    .map(value => value.trim())
    .filter(Boolean)));
}

async function listAllMealieShoppingItems(): Promise<MealieShoppingItem[]> {
  const items: MealieShoppingItem[] = [];
  let page = 1;
  const perPage = 500;

  while (true) {
    const response = await HouseholdsShoppingListItemsService.getAllApiHouseholdsShoppingItemsGet(
      'display',
      undefined,
      'asc',
      undefined,
      undefined,
      page,
      perPage,
    );
    const pageItems = extractShoppingItems(response);
    items.push(...pageItems);

    if (pageItems.length < perPage) {
      break;
    }

    page += 1;
  }

  return items;
}

async function listAllMealieRecipeSummaries(): Promise<RecipeSummary[]> {
  const recipes: RecipeSummary[] = [];
  let page = 1;
  const perPage = 500;

  while (true) {
    const response = await RecipeCrudService.getAllApiRecipesGet(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'name',
      undefined,
      'asc',
      undefined,
      undefined,
      page,
      perPage,
    );
    const pageItems = response.items ?? [];
    recipes.push(...pageItems);

    if (pageItems.length < perPage) {
      break;
    }

    page += 1;
  }

  return recipes;
}

function getGrocyUnitName(unit: QuantityUnit): string {
  return unit.name || 'Unknown';
}

function getMealieUnitName(unit: IngredientUnit_Output): string {
  return unit.name || 'Unknown';
}

function getProductName(product: Product): string {
  return product.name || `#${product.id ?? 'unknown'}`;
}

function getRecipeLookup(summary: RecipeSummary): string | null {
  return summary.slug ?? summary.id ?? null;
}

function getRecipeName(summary: RecipeSummary, recipe: Recipe_Output): string {
  return recipe.name || summary.name || summary.slug || summary.id || 'Unknown recipe';
}

function getShoppingItemLabel(item: MealieShoppingItem): string {
  return item.food?.name || item.display || item.id;
}

function getIngredientUnitId(unit: RecipeIngredient_Output['unit']): string | null {
  if (!unit || typeof unit !== 'object' || !('id' in unit) || typeof unit.id !== 'string') {
    return null;
  }

  return unit.id;
}

function buildGrocyUnitBlockers(
  grocyUnitId: number,
  mappings: UnitMappingRecord[],
  products: Product[],
  conversions: QuantityUnitConversion[],
): UnitDeleteBlocker[] {
  return [
    ...mappings
      .filter(mapping => mapping.grocyUnitId === grocyUnitId)
      .map(mapping => ({
        source: 'unit_mapping' as const,
        reference: mapping.id,
        message: `Unit mapping ${mapping.id} links this Grocy unit to Mealie unit "${mapping.mealieUnitName}".`,
      })),
    ...products
      .filter(product => Number(product.qu_id_purchase ?? 0) === grocyUnitId)
      .map(product => ({
        source: 'grocy_product_purchase_unit' as const,
        reference: `grocy:${product.id ?? 'unknown'}`,
        message: `Grocy product "${getProductName(product)}" uses this unit as its purchase unit.`,
      })),
    ...products
      .filter(product => Number(product.qu_id_stock ?? 0) === grocyUnitId)
      .map(product => ({
        source: 'grocy_product_stock_unit' as const,
        reference: `grocy:${product.id ?? 'unknown'}`,
        message: `Grocy product "${getProductName(product)}" uses this unit as its stock unit.`,
      })),
    ...conversions
      .filter(conversion => Number(conversion.from_qu_id ?? 0) === grocyUnitId)
      .map(conversion => ({
        source: 'grocy_conversion_from_unit' as const,
        reference: `conversion:${conversion.id ?? 'unknown'}`,
        message: `Grocy conversion #${conversion.id ?? 'unknown'} uses this unit as the source unit.`,
      })),
    ...conversions
      .filter(conversion => Number(conversion.to_qu_id ?? 0) === grocyUnitId)
      .map(conversion => ({
        source: 'grocy_conversion_to_unit' as const,
        reference: `conversion:${conversion.id ?? 'unknown'}`,
        message: `Grocy conversion #${conversion.id ?? 'unknown'} uses this unit as the target unit.`,
      })),
  ];
}

function buildMealieUnitMappingBlockers(
  mealieUnitId: string,
  mappings: UnitMappingRecord[],
): UnitDeleteBlocker[] {
  return mappings
    .filter(mapping => mapping.mealieUnitId === mealieUnitId)
    .map(mapping => ({
      source: 'unit_mapping' as const,
      reference: mapping.id,
      message: `Unit mapping ${mapping.id} links this Mealie unit to Grocy unit "${mapping.grocyUnitName}".`,
    }));
}

function buildMealieShoppingItemBlockers(
  mealieUnitId: string,
  items: MealieShoppingItem[],
): UnitDeleteBlocker[] {
  return items
    .filter(item => item.unitId === mealieUnitId || item.unit?.id === mealieUnitId)
    .map(item => ({
      source: 'mealie_shopping_item' as const,
      reference: item.id,
      message: `Mealie shopping item "${getShoppingItemLabel(item)}" uses this unit.`,
    }));
}

async function buildMealieRecipeBlockers(
  mealieUnitId: string,
  deps: Pick<UnitManageDeps, 'listMealieRecipeSummaries' | 'getMealieRecipe'>,
): Promise<UnitDeleteBlocker[]> {
  const summaries = await deps.listMealieRecipeSummaries();
  const blockers: UnitDeleteBlocker[] = [];
  const batchSize = 10;

  for (let index = 0; index < summaries.length; index += batchSize) {
    const batch = summaries.slice(index, index + batchSize);
    const batchBlockers = await Promise.all(
      batch.map(async summary => {
        const recipeLookup = getRecipeLookup(summary);

        if (!recipeLookup) {
          return null;
        }

        const recipe = await deps.getMealieRecipe(recipeLookup);
        const usesUnit = (recipe.recipeIngredient ?? [])
          .some(ingredient => getIngredientUnitId(ingredient.unit) === mealieUnitId);

        if (!usesUnit) {
          return null;
        }

        return {
          source: 'mealie_recipe' as const,
          reference: recipe.slug || recipe.id || recipeLookup,
          message: `Mealie recipe "${getRecipeName(summary, recipe)}" uses this unit in an ingredient.`,
        };
      }),
    );

    blockers.push(...batchBlockers.flatMap(blocker => (blocker ? [blocker] : [])));
  }

  return blockers;
}

const defaultDeps: UnitManageDeps = {
  ...defaultSyncLockDeps,
  listGrocyUnits: async () => getGrocyEntities('quantity_units'),
  listGrocyProducts: async () => getGrocyEntities('products'),
  listGrocyConversions: async () => getGrocyEntities('quantity_unit_conversions'),
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
  listMealieShoppingItems: listAllMealieShoppingItems,
  listMealieRecipeSummaries: listAllMealieRecipeSummaries,
  listUnitMappings: async () => db.select().from(unitMappings),
  createGrocyUnit: async body => {
    const result = await createGrocyEntity('quantity_units', body);
    const createdObjectId = Number(result.created_object_id ?? 0);

    if (!createdObjectId) {
      throw new Error('Grocy did not return a created unit id.');
    }

    return { createdObjectId };
  },
  createMealieUnit: body => RecipesUnitsService.createOneApiUnitsPost(body),
  getGrocyUnit: async grocyUnitId => {
    const unit = (await getGrocyEntities('quantity_units'))
      .find(entry => Number(entry.id) === grocyUnitId);
    if (!unit) {
      throw new Error(`Grocy unit #${grocyUnitId} was not found.`);
    }
    return unit;
  },
  updateGrocyUnit: (grocyUnitId, body) => updateGrocyEntity('quantity_units', grocyUnitId, body),
  deleteGrocyUnit: grocyUnitId => deleteGrocyEntity('quantity_units', grocyUnitId),
  getMealieUnit: mealieUnitId => RecipesUnitsService.getOneApiUnitsItemIdGet(mealieUnitId),
  getMealieRecipe: recipeLookup => RecipeCrudService.getOneApiRecipesSlugGet(recipeLookup),
  updateMealieUnit: async (mealieUnitId, body) => {
    await RecipesUnitsService.updateOneApiUnitsItemIdPut(mealieUnitId, body as never);
  },
  deleteMealieUnit: async mealieUnitId => {
    await RecipesUnitsService.deleteOneApiUnitsItemIdDelete(mealieUnitId);
  },
};

export async function getUnitCatalog(
  deps: Pick<UnitManageDeps, 'listGrocyUnits' | 'listMealieUnits' | 'listUnitMappings'> = defaultDeps,
): Promise<UnitCatalogResource> {
  const [grocyUnits, mealieUnits, mappings] = await Promise.all([
    deps.listGrocyUnits(),
    deps.listMealieUnits(),
    deps.listUnitMappings(),
  ]);

  const mappingByGrocyUnitId = new Map(mappings.map(mapping => [mapping.grocyUnitId, mapping.id]));
  const mappingByMealieUnitId = new Map(mappings.map(mapping => [mapping.mealieUnitId, mapping.id]));

  return {
    counts: {
      grocyUnits: grocyUnits.length,
      mealieUnits: mealieUnits.length,
      mappedUnits: mappings.length,
    },
    grocyUnits: grocyUnits
      .map(unit => ({
        id: Number(unit.id),
        name: unit.name || 'Unknown',
        pluralName: unit.name_plural || null,
        pluralForms: parsePluralForms(unit.plural_forms),
        mappingId: mappingByGrocyUnitId.get(Number(unit.id)) ?? null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    mealieUnits: mealieUnits
      .map(unit => ({
        id: unit.id,
        name: unit.name || 'Unknown',
        pluralName: unit.pluralName || null,
        abbreviation: unit.abbreviation || '',
        pluralAbbreviation: unit.pluralAbbreviation || null,
        aliases: parseAliasNames(unit.aliases),
        mappingId: mappingByMealieUnitId.get(unit.id) ?? null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export async function createGrocyUnit(
  params: CreateGrocyUnitParams,
  deps: Pick<
    UnitManageDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'listGrocyUnits' | 'createGrocyUnit'
  > = defaultDeps,
): Promise<CreateGrocyUnitResult> {
  return runWithSyncLock(deps, async () => {
    const normalizedName = normalizeUnitName(params.name);
    const exactMatches = (await deps.listGrocyUnits())
      .filter(unit => normalizeUnitName(unit.name) === normalizedName);

    if (exactMatches.length > 0) {
      const existingUnit = exactMatches[0];
      return {
        created: false,
        grocyUnitId: Number(existingUnit?.id ?? 0) || null,
        grocyUnitName: existingUnit?.name || params.name,
        duplicateCheck: {
          skipped: true,
          exactGrocyMatches: exactMatches.length,
        },
      };
    }

    const payload: CreateQuantityUnitBody = {
      name: params.name,
      name_plural: params.pluralName ?? params.name,
      ...(params.description ? { description: params.description } : {}),
      ...(params.pluralForms && params.pluralForms.length > 0
        ? { plural_forms: toUniqueTrimmedNames(params.pluralForms).join('\n') }
        : {}),
    };
    const { createdObjectId } = await deps.createGrocyUnit(payload);

    return {
      created: true,
      grocyUnitId: createdObjectId,
      grocyUnitName: params.name,
      duplicateCheck: {
        skipped: false,
        exactGrocyMatches: 0,
      },
    };
  });
}

export async function createMealieUnit(
  params: CreateMealieUnitParams,
  deps: Pick<
    UnitManageDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'listMealieUnits' | 'createMealieUnit'
  > = defaultDeps,
): Promise<CreateMealieUnitResult> {
  return runWithSyncLock(deps, async () => {
    const normalizedName = normalizeUnitName(params.name);
    const exactMatches = (await deps.listMealieUnits())
      .filter(unit => normalizeUnitName(unit.name) === normalizedName);

    if (exactMatches.length > 0) {
      const existingUnit = exactMatches[0];
      return {
        created: false,
        mealieUnitId: existingUnit?.id ?? null,
        mealieUnitName: existingUnit?.name || params.name,
        duplicateCheck: {
          skipped: true,
          exactMealieMatches: exactMatches.length,
        },
      };
    }

    const aliases = toUniqueTrimmedNames(params.aliases);
    const createdUnit = await deps.createMealieUnit({
      name: params.name,
      pluralName: params.pluralName ?? null,
      ...(params.description ? { description: params.description } : {}),
      ...(params.abbreviation ? { abbreviation: params.abbreviation } : {}),
      pluralAbbreviation: params.pluralAbbreviation ?? null,
      fraction: params.fraction,
      useAbbreviation: params.useAbbreviation ?? Boolean(params.abbreviation),
      aliases: aliases.map(name => ({ name })),
    });

    return {
      created: true,
      mealieUnitId: createdUnit.id,
      mealieUnitName: createdUnit.name || params.name,
      duplicateCheck: {
        skipped: false,
        exactMealieMatches: 0,
      },
    };
  });
}

export async function updateGrocyUnitMetadata(
  params: UpdateGrocyUnitMetadataParams,
  deps: Pick<UnitManageDeps, 'acquireSyncLock' | 'releaseSyncLock' | 'updateGrocyUnit'> = defaultDeps,
): Promise<UpdateGrocyUnitMetadataResult> {
  return runWithSyncLock(deps, async () => {
    const update: Record<string, unknown> = {};
    const updated: UpdateGrocyUnitMetadataResult['updated'] = {};

    if (params.name !== undefined) {
      update.name = params.name;
      updated.name = params.name;
    }

    if (params.pluralName !== undefined) {
      update.name_plural = params.pluralName;
      updated.pluralName = params.pluralName;
    }

    if (params.pluralForms !== undefined) {
      update.plural_forms = params.pluralForms.join('\n');
      updated.pluralForms = params.pluralForms;
    }

    if (params.description !== undefined) {
      update.description = params.description;
      updated.description = params.description;
    }

    requireUnitMetadataUpdate('Grocy unit', updated);
    await deps.updateGrocyUnit(params.grocyUnitId, update);

    return {
      grocyUnitId: params.grocyUnitId,
      updated,
    };
  });
}

export async function updateMealieUnitMetadata(
  params: UpdateMealieUnitMetadataParams,
  deps: Pick<
    UnitManageDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'getMealieUnit' | 'updateMealieUnit'
  > = defaultDeps,
): Promise<UpdateMealieUnitMetadataResult> {
  return runWithSyncLock(deps, async () => {
    const updated: UpdateMealieUnitMetadataResult['updated'] = {};

    if (params.name !== undefined) {
      updated.name = params.name;
    }

    if (params.pluralName !== undefined) {
      updated.pluralName = params.pluralName;
    }

    if (params.abbreviation !== undefined) {
      updated.abbreviation = params.abbreviation;
    }

    if (params.pluralAbbreviation !== undefined) {
      updated.pluralAbbreviation = params.pluralAbbreviation;
    }

    if (params.aliases !== undefined) {
      updated.aliases = params.aliases;
    }

    requireUnitMetadataUpdate('Mealie unit', updated);

    const currentUnit = await deps.getMealieUnit(params.mealieUnitId);

    const payload = {
      id: currentUnit.id,
      name: params.name ?? currentUnit.name,
      pluralName: params.pluralName ?? currentUnit.pluralName ?? null,
      description: currentUnit.description,
      extras: currentUnit.extras,
      fraction: currentUnit.fraction,
      abbreviation: params.abbreviation ?? currentUnit.abbreviation ?? '',
      pluralAbbreviation: params.pluralAbbreviation ?? currentUnit.pluralAbbreviation ?? null,
      useAbbreviation: currentUnit.useAbbreviation,
      aliases: params.aliases
        ? params.aliases.map(name => ({ name }))
        : (currentUnit.aliases ?? []),
    };

    await deps.updateMealieUnit(params.mealieUnitId, payload);

    return {
      mealieUnitId: params.mealieUnitId,
      updated,
    };
  });
}

export async function deleteGrocyUnit(
  params: DeleteGrocyUnitParams,
  deps: Pick<
    UnitManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'getGrocyUnit'
    | 'deleteGrocyUnit'
    | 'listUnitMappings'
    | 'listGrocyProducts'
    | 'listGrocyConversions'
  > = defaultDeps,
): Promise<DeleteGrocyUnitResult> {
  return runWithSyncLock(deps, async () => {
    const [unit, mappings, products, conversions] = await Promise.all([
      deps.getGrocyUnit(params.grocyUnitId),
      deps.listUnitMappings(),
      deps.listGrocyProducts(),
      deps.listGrocyConversions(),
    ]);
    const blockers = buildGrocyUnitBlockers(params.grocyUnitId, mappings, products, conversions);

    if (blockers.length > 0) {
      return {
        deleted: false,
        blocked: true,
        grocyUnitId: params.grocyUnitId,
        grocyUnitName: getGrocyUnitName(unit),
        blockers,
      };
    }

    await deps.deleteGrocyUnit(params.grocyUnitId);

    return {
      deleted: true,
      blocked: false,
      grocyUnitId: params.grocyUnitId,
      grocyUnitName: getGrocyUnitName(unit),
      blockers: [],
    };
  });
}

export async function deleteMealieUnit(
  params: DeleteMealieUnitParams,
  deps: Pick<
    UnitManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'getMealieUnit'
    | 'deleteMealieUnit'
    | 'listUnitMappings'
    | 'listMealieShoppingItems'
    | 'listMealieRecipeSummaries'
    | 'getMealieRecipe'
  > = defaultDeps,
): Promise<DeleteMealieUnitResult> {
  return runWithSyncLock(deps, async () => {
    const [unit, mappings] = await Promise.all([
      deps.getMealieUnit(params.mealieUnitId),
      deps.listUnitMappings(),
    ]);
    const mappingBlockers = buildMealieUnitMappingBlockers(params.mealieUnitId, mappings);

    // Stop after the first blocker category. Recipe scans are the most expensive path,
    // so this phased check keeps the common "still mapped" and "still in shopping list"
    // cases cheap even though it does not aggregate every possible blocker in one call.
    if (mappingBlockers.length > 0) {
      return {
        deleted: false,
        blocked: true,
        mealieUnitId: params.mealieUnitId,
        mealieUnitName: getMealieUnitName(unit),
        blockers: mappingBlockers,
      };
    }

    const shoppingBlockers = buildMealieShoppingItemBlockers(
      params.mealieUnitId,
      await deps.listMealieShoppingItems(),
    );

    if (shoppingBlockers.length > 0) {
      return {
        deleted: false,
        blocked: true,
        mealieUnitId: params.mealieUnitId,
        mealieUnitName: getMealieUnitName(unit),
        blockers: shoppingBlockers,
      };
    }

    const recipeBlockers = await buildMealieRecipeBlockers(params.mealieUnitId, deps);

    if (recipeBlockers.length > 0) {
      return {
        deleted: false,
        blocked: true,
        mealieUnitId: params.mealieUnitId,
        mealieUnitName: getMealieUnitName(unit),
        blockers: recipeBlockers,
      };
    }

    await deps.deleteMealieUnit(params.mealieUnitId);

    return {
      deleted: true,
      blocked: false,
      mealieUnitId: params.mealieUnitId,
      mealieUnitName: getMealieUnitName(unit),
      blockers: [],
    };
  });
}

export async function compareUnits(
  params: CompareUnitsParams,
  deps: Pick<UnitManageDeps, 'getMealieUnit' | 'getGrocyUnit' | 'listUnitMappings'> = defaultDeps,
): Promise<CompareUnitsResult> {
  const [mealieUnit, grocyUnit, mappings] = await Promise.all([
    deps.getMealieUnit(params.mealieUnitId),
    deps.getGrocyUnit(params.grocyUnitId),
    deps.listUnitMappings(),
  ]);

  const mealieAliases = parseAliasNames(mealieUnit.aliases);
  const grocyPluralForms = parsePluralForms(grocyUnit.plural_forms);
  const normalizedGrocyNames = [grocyUnit.name || '', grocyUnit.name_plural || '', ...grocyPluralForms]
    .map(value => value.toLowerCase());
  const currentlyMapped = mappings.some(mapping =>
    mapping.mealieUnitId === params.mealieUnitId && mapping.grocyUnitId === params.grocyUnitId,
  );
  const nameMatches = mealieUnit.name === (grocyUnit.name || 'Unknown');
  const aliasMatches = mealieAliases.some(alias =>
    normalizedGrocyNames.includes(alias.toLowerCase()),
  );

  const notes: string[] = [];
  if (aliasMatches) {
    notes.push('The Mealie unit aliases overlap with the Grocy unit naming.');
  }

  return {
    mealieUnitId: params.mealieUnitId,
    grocyUnitId: params.grocyUnitId,
    currentlyMapped,
    nameMatches,
    aliasMatches,
    mealieUnit: {
      id: mealieUnit.id,
      name: mealieUnit.name || 'Unknown',
      pluralName: mealieUnit.pluralName || null,
      abbreviation: mealieUnit.abbreviation || '',
      pluralAbbreviation: mealieUnit.pluralAbbreviation || null,
      aliases: mealieAliases,
      mappingId: mappings.find(mapping => mapping.mealieUnitId === params.mealieUnitId)?.id ?? null,
    },
    grocyUnit: {
      id: Number(grocyUnit.id),
      name: grocyUnit.name || 'Unknown',
      pluralName: grocyUnit.name_plural || null,
      pluralForms: grocyPluralForms,
      mappingId: mappings.find(mapping => mapping.grocyUnitId === params.grocyUnitId)?.id ?? null,
    },
    notes,
  };
}

export async function normalizeMappedUnits(): Promise<NormalizeMappedUnitsResult> {
  return runUnitNormalization();
}
