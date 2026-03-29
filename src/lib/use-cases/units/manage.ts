import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import {
  createGrocyEntity,
  getGrocyEntities,
  updateGrocyEntity,
  type CreateQuantityUnitBody,
  type QuantityUnit,
} from '@/lib/grocy/types';
import { RecipesUnitsService } from '@/lib/mealie';
import type { CreateIngredientUnit } from '@/lib/mealie/client/models/CreateIngredientUnit';
import type { IngredientUnit_Output } from '@/lib/mealie/client/models/IngredientUnit_Output';
import { extractUnits } from '@/lib/mealie/types';
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
  listMealieUnits(): Promise<IngredientUnit_Output[]>;
  listUnitMappings(): Promise<UnitMappingRecord[]>;
  createGrocyUnit(body: CreateQuantityUnitBody): Promise<{ createdObjectId: number }>;
  createMealieUnit(body: CreateIngredientUnit): Promise<IngredientUnit_Output>;
  getGrocyUnit(grocyUnitId: number): Promise<QuantityUnit>;
  updateGrocyUnit(grocyUnitId: number, body: Record<string, unknown>): Promise<void>;
  getMealieUnit(mealieUnitId: string): Promise<IngredientUnit_Output>;
  updateMealieUnit(mealieUnitId: string, body: Record<string, unknown>): Promise<void>;
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

const defaultDeps: UnitManageDeps = {
  ...defaultSyncLockDeps,
  listGrocyUnits: async () => getGrocyEntities('quantity_units'),
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
  getMealieUnit: mealieUnitId => RecipesUnitsService.getOneApiUnitsItemIdGet(mealieUnitId),
  updateMealieUnit: async (mealieUnitId, body) => {
    await RecipesUnitsService.updateOneApiUnitsItemIdPut(mealieUnitId, body as never);
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
      updated: {
        name: params.name,
        pluralName: params.pluralName,
        abbreviation: params.abbreviation,
        pluralAbbreviation: params.pluralAbbreviation,
        aliases: params.aliases,
      },
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
