import { createHash, randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { getGrocyEntities, createGrocyEntity, type QuantityUnit, type QuantityUnitConversion, type CreateQuantityUnitBody } from '@/lib/grocy/types';
import { AppAboutService, RecipesUnitsService } from '@/lib/mealie';
import { extractUnits } from '@/lib/mealie/types';
import type { IngredientUnit_Output } from '@/lib/mealie/client/models/IngredientUnit_Output';
import { recordHistoryRun } from '@/lib/history-store';
import { log } from '@/lib/logger';
import { defaultSyncLockDeps, noopSyncLockDeps, runWithSyncLock, type SyncLockDeps } from '../shared/sync-lock';
import { updateMealieUnitMetadata } from '../units/manage';
import { CATALOG_VERSION, LIBRARY_ENTRIES, factorsEqual, standardScale, type LibraryUnit } from '@/lib/conversions/catalog';
import { importSelectionSchema, libraryImportSchema, type ImportPreview, type UnitPlan, type EntryPlan, type ImportResult, type ImportStep } from '@/lib/conversions/contracts';

interface Mapping { id: string; mealieUnitId: string; grocyUnitId: number; conversionFactor: number }
export interface LibraryState {
  grocyUnits: QuantityUnit[];
  mealieUnits: IngredientUnit_Output[];
  mappings: Mapping[];
  conversions: QuantityUnitConversion[];
  mealieStandardization?: boolean;
}
export interface LibraryDeps extends SyncLockDeps {
  readState(target: 'both' | 'grocy'): Promise<LibraryState>;
  getMealieUnit(id: string): Promise<IngredientUnit_Output>;
  listMappings(): Promise<Mapping[]>;
  listConversions(): Promise<QuantityUnitConversion[]>;
  createGrocyUnit(body: CreateQuantityUnitBody): Promise<number>;
  createMealieUnit(body: { name: string; pluralName: string; abbreviation: string; standardQuantity: number; standardUnit: string }): Promise<IngredientUnit_Output>;
  standardizeMealie(id: string, quantity: number, unit: string): Promise<void>;
  createMapping(mealie: { id: string; name: string; abbreviation?: string }, grocy: { id: number; name: string }): Promise<string>;
  createConversion(from: number, to: number, factor: number): Promise<number>;
  recordImport(result: ImportResult, source: 'manual' | 'mcp', startedAt: Date): Promise<void>;
}

async function allMealieUnits() {
  const units: IngredientUnit_Output[] = [];
  for (let page = 1; page <= 50; page++) {
    const batch = extractUnits(await RecipesUnitsService.getAllApiUnitsGet(undefined, undefined, undefined, 'asc', undefined, undefined, page, 1000));
    units.push(...batch);
    if (batch.length < 1000) return units;
  }
  throw new Error('The Mealie unit catalog exceeds the supported import size.');
}
function createdId(result: { created_object_id?: number }) {
  const id = Number(result.created_object_id);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Grocy did not return a created object ID. Refresh before retrying.');
  return id;
}

const defaultDeps: LibraryDeps = {
  ...defaultSyncLockDeps,
  readState: async target => {
    const [grocyUnits, mealieUnits, mappings, conversions] = await Promise.all([
      getGrocyEntities('quantity_units'), target === 'both' ? allMealieUnits() : Promise.resolve([]), db.select().from(unitMappings), getGrocyEntities('quantity_unit_conversions'),
    ]);
    let mealieStandardization = mealieUnits.some(u => 'standardQuantity' in u && 'standardUnit' in u);
    if (target === 'both' && !mealieStandardization) {
      const info = await AppAboutService.getAppInfoApiAppAboutGet();
      const version = info.version.match(/^(?:v)?(\d+)\.(\d+)\./);
      mealieStandardization = Boolean(version && (Number(version[1]) > 3 || (Number(version[1]) === 3 && Number(version[2]) >= 13)));
    }
    return { grocyUnits, mealieUnits, mappings, conversions, mealieStandardization };
  },
  getMealieUnit: id => RecipesUnitsService.getOneApiUnitsItemIdGet(id),
  listMappings: () => db.select().from(unitMappings),
  listConversions: () => getGrocyEntities('quantity_unit_conversions'),
  createGrocyUnit: async body => createdId(await createGrocyEntity('quantity_units', body)),
  createMealieUnit: body => RecipesUnitsService.createOneApiUnitsPost({ ...body, useAbbreviation: true, fraction: false }),
  standardizeMealie: async (id, standardQuantity, standardUnit) => {
    await updateMealieUnitMetadata({ mealieUnitId: id, standardQuantity, standardUnit }, {
      ...noopSyncLockDeps,
      getMealieUnit: async unitId => {
        const current = await RecipesUnitsService.getOneApiUnitsItemIdGet(unitId);
        if (current.standardQuantity != null || current.standardUnit) {
          const existing = standardScale(current.standardUnit, current.standardQuantity);
          const proposed = standardScale(standardUnit, standardQuantity)!;
          if (!existing || existing.dimension !== proposed.dimension || !factorsEqual(existing.scale, proposed.scale)) throw new Error('The Mealie standardization changed during import.');
        }
        return current;
      },
      updateMealieUnit: async (unitId, body) => { await RecipesUnitsService.updateOneApiUnitsItemIdPut(unitId, body as IngredientUnit_Output); },
    });
  },
  createMapping: async (mealie, grocy) => {
    const id = randomUUID();
    await db.insert(unitMappings).values({ id, mealieUnitId: mealie.id, mealieUnitName: mealie.name,
      mealieUnitAbbreviation: mealie.abbreviation ?? '', grocyUnitId: grocy.id, grocyUnitName: grocy.name,
      conversionFactor: 1, createdAt: new Date(), updatedAt: new Date() });
    return id;
  },
  createConversion: async (from, to, factor) => createdId(await createGrocyEntity('quantity_unit_conversions', { from_qu_id: from, to_qu_id: to, factor })),
  recordImport: async (result, source, startedAt) => {
    await recordHistoryRun({ action: 'conversion_import', trigger: 'manual', status: result.status, startedAt, finishedAt: new Date(),
      message: `Conversion library: ${result.created} change(s), ${result.failed} failure(s).`, summary: { ...result, source },
      events: result.steps.filter(s => s.status !== 'skipped').map(s => ({
        level: s.status === 'failed' ? 'error' as const : 'info' as const,
        category: 'mapping' as const, entityKind: 'unit' as const, entityRef: s.id ? `${s.system.toLowerCase()}:${s.kind}:${s.id}` : null,
        message: s.message, details: { ...s, source },
      })),
    });
  },
};

export class ConversionLibraryError extends Error {
  constructor(public readonly code: 'PREVIEW_STALE' | 'IMPORT_BLOCKED' | 'INVALID_SELECTION', message: string, public readonly preview?: ImportPreview) {
    super(message);
  }
}

const normalize = (name: string) => name.trim().toLowerCase();
function matchesName(unit: LibraryUnit, names: string[]) {
  const aliases = [unit.name, unit.abbreviation, ...unit.aliases].map(normalize);
  return names.some(name => aliases.includes(normalize(name)));
}
function matchesStandard(unit: LibraryUnit, mealie: IngredientUnit_Output) {
  const scale = standardScale(mealie.standardUnit, mealie.standardQuantity);
  return scale?.dimension === unit.dimension && factorsEqual(scale.scale, unit.scale);
}

// Resolve a connected component using weighted edges. Conflicting paths block import.
export function conversionRelation(conversions: QuantityUnitConversion[], from: number, to: number): { factor?: number; conflict?: boolean } {
  const graph = new Map<number, Array<{ id: number; factor: number }>>();
  function connect(a: number, b: number, factor: number) {
    const edges = graph.get(a);
    if (edges) edges.push({ id: b, factor });
    else graph.set(a, [{ id: b, factor }]);
  }
  if (conversions.length > 20_000) return { conflict: true };
  for (const c of conversions) {
    if (c.product_id != null && Number(c.product_id) !== 0) continue;
    const a = Number(c.from_qu_id), b = Number(c.to_qu_id), factor = Number(c.factor);
    if (!a || !b) continue;
    connect(a, b, factor);
    connect(b, a, 1 / factor);
  }
  const scales = new Map([[from, 1]]);
  const queue = [from];
  let conflict = false;
  for (let i = 0; i < queue.length; i++) {
    if (queue.length > 5000) return { conflict: true };
    for (const edge of graph.get(queue[i]) ?? []) {
      const value = scales.get(queue[i])! * edge.factor;
      if (!(value > 0) || !Number.isFinite(value)) { conflict = true; continue; }
      if (scales.has(edge.id)) {
        if (!factorsEqual(scales.get(edge.id)!, value)) conflict = true;
      } else { scales.set(edge.id, value); queue.push(edge.id); }
    }
  }
  return { factor: scales.get(to), ...(conflict ? { conflict: true } : {}) };
}

export async function previewConversionImport(input: unknown, deps: Pick<LibraryDeps, 'readState'> = defaultDeps): Promise<ImportPreview> {
  const parsed = importSelectionSchema.parse(input);
  const selection = { ...parsed, entryIds: [...new Set(parsed.entryIds)].sort() };
  const entries = selection.entryIds.map(id => {
    const entry = LIBRARY_ENTRIES.find(e => e.id === id);
    if (!entry) throw new ConversionLibraryError('INVALID_SELECTION', `Unknown library entry: ${id}`);
    return entry;
  });
  const required = new Map(entries.flatMap(e => [[e.from.id, e.from], [e.to.id, e.to]] as const));
  if (Object.keys(selection.bindings).some(id => !required.has(id))) throw new ConversionLibraryError('INVALID_SELECTION', 'Bindings must belong to the selected entries.');
  const state = await deps.readState(selection.target);
  const units: UnitPlan[] = [...required.values()].sort((a, b) => a.id.localeCompare(b.id)).map(unit => {
    const binding = selection.bindings[unit.id];
    const problems: string[] = [];
    if (selection.target === 'both' && state.mealieStandardization === false) problems.push('Shared standardization requires Mealie 3.13 or newer. Update Mealie or choose Grocy only.');
    const mealieCandidates = state.mealieUnits.filter(m => matchesName(unit, [m.name, m.abbreviation ?? '', ...(m.aliases ?? []).map(a => a.name)]))
      .sort((a, b) => a.id.localeCompare(b.id));
    const grocyCandidates = state.grocyUnits.filter(g => matchesName(unit, [g.name ?? '', g.name_plural ?? '']))
      .sort((a, b) => Number(a.id) - Number(b.id));
    let mealie = binding?.mealieUnitId ? state.mealieUnits.find(m => m.id === binding.mealieUnitId) ?? null :
      mealieCandidates.length === 1 && (!unit.ambiguous || matchesStandard(unit, mealieCandidates[0]) || normalize(mealieCandidates[0].name) === normalize(unit.name)) ? mealieCandidates[0] : null;
    let grocy = binding?.grocyUnitId ? state.grocyUnits.find(g => Number(g.id) === binding.grocyUnitId) ?? null :
      grocyCandidates.length === 1 && (!unit.ambiguous || normalize(grocyCandidates[0].name ?? '') === normalize(unit.name)) ? grocyCandidates[0] : null;
    if (selection.target === 'grocy') mealie = null;
    if (binding?.createMealie) mealie = null;
    if (binding?.createGrocy) grocy = null;
    const mapping = mealie ? state.mappings.find(m => m.mealieUnitId === mealie?.id) : undefined;
    if (mapping && !binding?.grocyUnitId && !binding?.createGrocy) grocy = state.grocyUnits.find(g => Number(g.id) === mapping.grocyUnitId) ?? null;
    if (grocy && !mealie && selection.target === 'both' && !binding?.mealieUnitId && !binding?.createMealie) {
      const reverse = state.mappings.find(m => m.grocyUnitId === Number(grocy.id));
      if (reverse) mealie = state.mealieUnits.find(m => m.id === reverse.mealieUnitId) ?? null;
    }
    if (binding?.grocyUnitId && !grocy) problems.push('The selected Grocy unit no longer exists.');
    if (binding?.mealieUnitId && !mealie && selection.target === 'both') problems.push('The selected Mealie unit no longer exists.');
    if ((binding?.createMealie && binding.mealieUnitId) || (binding?.createGrocy && binding.grocyUnitId)) problems.push('Choose either an existing unit or creation for each system.');
    if (selection.target === 'both' && state.mappings.some(m => (mealie?.id === m.mealieUnitId && !state.grocyUnits.some(g => Number(g.id) === m.grocyUnitId)) || (Number(grocy?.id) === m.grocyUnitId && !state.mealieUnits.some(u => u.id === m.mealieUnitId)))) problems.push('An existing mapping points to an unavailable unit. Repair the mapping first.');
    if (!grocy && grocyCandidates.length && !binding?.createGrocy) problems.push('Choose which Grocy unit represents this measurement.');
    if (!mealie && mealieCandidates.length && selection.target === 'both' && !binding?.createMealie) problems.push('Choose which Mealie unit represents this measurement.');
    if (!selection.createMissingUnits && (!grocy || (selection.target === 'both' && !mealie))) problems.push('Allow creation of missing units or choose an existing unit.');
    if (mealie && (mealie.standardQuantity != null || mealie.standardUnit)) {
      if (mealie.standardUnit && !standardScale(mealie.standardUnit, 1)) problems.push(`Mealie uses an unrecognized standard unit (${mealie.standardUnit}). Review that definition before importing.`);
      else if (!matchesStandard(unit, mealie)) problems.push(`Mealie already defines ${mealie.name} as ${mealie.standardQuantity} ${mealie.standardUnit}; it differs from this preset.`);
    }
    if (grocy && mealie) {
      const existing = state.mappings.find(m => m.mealieUnitId === mealie.id || m.grocyUnitId === Number(grocy.id));
      if (existing && (existing.mealieUnitId !== mealie.id || existing.grocyUnitId !== Number(grocy.id) || !factorsEqual(existing.conversionFactor, 1))) problems.push('An existing unit mapping conflicts with this pair.');
    }
    return { unit, mealie: mealie ? { id: mealie.id, name: mealie.name, abbreviation: mealie.abbreviation ?? '' } : null,
      grocy: grocy ? { id: Number(grocy.id), name: grocy.name ?? unit.name } : null,
      mealieCandidates: mealieCandidates.map(m => ({ id: m.id, name: m.name })),
      grocyCandidates: grocyCandidates.map(g => ({ id: Number(g.id), name: g.name ?? unit.name })),
      createMealie: selection.target === 'both' && !mealie, createGrocy: !grocy,
      standardizeMealie: Boolean(mealie && !mealie.standardQuantity && !mealie.standardUnit),
      createMapping: selection.target === 'both' && !state.mappings.some(m => m.mealieUnitId === mealie?.id && m.grocyUnitId === Number(grocy?.id)),
      name: binding?.name ?? mealie?.name ?? grocy?.name ?? unit.name,
      pluralName: binding?.pluralName ?? mealie?.pluralName ?? grocy?.name_plural ?? unit.pluralName,
      problems };
  });
  for (const u of units) {
    if (u.createGrocy && state.grocyUnits.some(g => normalize(g.name ?? '') === normalize(u.name))) u.problems.push('A Grocy unit with this name already exists. Choose it or give the new unit a different name.');
    if (u.createMealie && state.mealieUnits.some(m => normalize(m.name) === normalize(u.name))) u.problems.push('A Mealie unit with this name already exists. Choose it or give the new unit a different name.');
  }
  for (const u of units) {
    if (units.some(other => other !== u && ((u.grocy && u.grocy.id === other.grocy?.id) || (u.mealie && u.mealie.id === other.mealie?.id) || ((!u.grocy || u.createMealie) && normalize(u.name) === normalize(other.name)))))
      u.problems.push('Different measurements cannot reuse the same unit.');
  }
  const entryPlans: EntryPlan[] = entries.map(entry => {
    const from = units.find(u => u.unit.id === entry.from.id)!, to = units.find(u => u.unit.id === entry.to.id)!;
    if (from.problems.length || to.problems.length) return { entry, status: 'needs_unit_selection', message: [...from.problems, ...to.problems].join(' ') };
    const relation = from.grocy && to.grocy ? conversionRelation(state.conversions, from.grocy.id, to.grocy.id) : {};
    if (relation.conflict || (relation.factor !== undefined && !factorsEqual(relation.factor, entry.factor))) return { entry, status: 'conflict', message: 'An existing Grocy conversion has a different factor or inconsistent paths.', existingFactor: relation.factor };
    if (relation.factor !== undefined) return { entry, status: 'already_available', message: 'Grocy already provides this conversion, directly or through other units.', existingFactor: relation.factor };
    return { entry, status: 'ready', message: 'Ready to add this conversion to Grocy.' };
  });
  const counts = { units: units.reduce((n, u) => n + Number(u.createMealie) + Number(u.createGrocy), 0),
    standardizations: units.filter(u => u.standardizeMealie).length, mappings: units.filter(u => u.createMapping).length,
    conversions: entryPlans.filter(e => e.status === 'ready').length,
    available: entryPlans.filter(e => e.status === 'already_available').length,
    blocked: entryPlans.filter(e => e.status === 'conflict' || e.status === 'needs_unit_selection').length };
  const fingerprint = createHash('sha256').update(JSON.stringify({ version: CATALOG_VERSION, selection, units, entries: entryPlans, counts })).digest('hex');
  return { version: CATALOG_VERSION, selection, fingerprint, units, entries: entryPlans, canImport: counts.blocked === 0, counts };
}

export async function importConversionLibrary(input: unknown, deps: LibraryDeps = defaultDeps, source: 'manual' | 'mcp' = 'manual'): Promise<ImportResult> {
  const { fingerprint, ...selection } = libraryImportSchema.parse(input);
  return runWithSyncLock(deps, async () => {
    const preview = await previewConversionImport(selection, deps);
    if (preview.fingerprint !== fingerprint) throw new ConversionLibraryError('PREVIEW_STALE', 'Your units or conversions changed. Review a fresh preview before importing.', preview);
    if (!preview.canImport) throw new ConversionLibraryError('IMPORT_BLOCKED', 'Resolve the highlighted unit choices and conflicts before importing.', preview);
    const startedAt = new Date(), steps: ImportStep[] = [];
    const resolved = new Map<string, { mealie: { id: string; name: string; abbreviation?: string } | null; grocy: { id: number; name: string } }>();
    for (const plan of preview.units) {
      let mealie = plan.mealie, grocy = plan.grocy;
      let system: ImportStep['system'] = 'Mealie', kind: ImportStep['kind'] = 'unit';
      try {
        if (plan.createMealie) {
          mealie = await deps.createMealieUnit({ name: plan.name, pluralName: plan.pluralName, abbreviation: plan.unit.abbreviation, standardQuantity: plan.unit.scale, standardUnit: plan.unit.standardUnit });
          steps.push({ system, kind, unitId: plan.unit.id, name: plan.name, status: 'created', id: mealie.id, message: `Created Mealie unit ${plan.name}.` });
          const current = await deps.getMealieUnit(mealie.id);
          if (!current || !matchesStandard(plan.unit, current)) throw new Error('Mealie returned unexpected standardization. Review its unit before retrying.');
        }
        if (plan.standardizeMealie && mealie) {
          kind = 'standardization';
          await deps.standardizeMealie(mealie.id, plan.unit.scale, plan.unit.standardUnit);
          steps.push({ system, kind, unitId: plan.unit.id, name: mealie.name, status: 'updated', id: mealie.id, message: `Set ${mealie.name} to ${plan.unit.scale} ${plan.unit.standardUnit} in Mealie.` });
          const current = await deps.getMealieUnit(mealie.id);
          if (!current || !matchesStandard(plan.unit, current)) throw new Error('Mealie did not retain the requested standardization. Review its unit before retrying.');
        }
        system = 'Grocy'; kind = 'unit';
        if (plan.createGrocy) {
          const id = await deps.createGrocyUnit({ name: plan.name, name_plural: plan.pluralName });
          grocy = { id, name: plan.name };
          steps.push({ system, kind, unitId: plan.unit.id, name: plan.name, status: 'created', id, message: `Created Grocy unit ${plan.name}.` });
        }
        if (!grocy) throw new Error('The Grocy unit could not be resolved.');
        system = 'App'; kind = 'mapping';
        if (plan.createMapping && mealie) {
          const mappings = await deps.listMappings();
          const mapping = mappings.find(m => m.mealieUnitId === mealie!.id || m.grocyUnitId === grocy!.id);
          if (mapping && (mapping.mealieUnitId !== mealie.id || mapping.grocyUnitId !== grocy.id || !factorsEqual(mapping.conversionFactor, 1))) throw new Error('The unit mapping changed during import.');
          if (!mapping) {
            const id = await deps.createMapping(mealie, grocy);
            steps.push({ system, kind, unitId: plan.unit.id, name: plan.name, status: 'created', id, message: `Linked ${mealie.name} in Mealie to ${grocy.name} in Grocy.` });
          }
        }
        resolved.set(plan.unit.id, { mealie, grocy });
      } catch (error) {
        steps.push({ system, kind, unitId: plan.unit.id, name: plan.name, status: 'failed', message: error instanceof Error ? error.message : 'Unit setup failed.' });
      }
    }
    for (const { entry } of preview.entries) {
      const from = resolved.get(entry.from.id)?.grocy, to = resolved.get(entry.to.id)?.grocy;
      const step = { system: 'Grocy' as const, kind: 'conversion' as const, unitId: entry.from.id, name: entry.equation };
      try {
        if (!from || !to) throw new Error('A required unit could not be set up. Retry after resolving its error.');
        const conversions = await deps.listConversions();
        const relation = conversionRelation(conversions, from.id, to.id);
        if (relation.conflict || (relation.factor !== undefined && !factorsEqual(relation.factor, entry.factor))) throw new Error('A conflicting conversion appeared during import.');
        if (relation.factor !== undefined) steps.push({ ...step, status: 'skipped', message: `Already available: ${entry.equation}.` });
        else {
          const id = await deps.createConversion(from.id, to.id, entry.factor);
          steps.push({ ...step, id, status: 'created', message: `Added ${entry.equation} in Grocy.` });
        }
      } catch (error) {
        steps.push({ ...step, status: 'failed', message: error instanceof Error ? error.message : 'Conversion import failed.' });
      }
    }
    const created = steps.filter(s => s.status === 'created' || s.status === 'updated').length;
    const failed = steps.filter(s => s.status === 'failed').length;
    const result: ImportResult = { steps, created, failed, status: failed ? (created ? 'partial' : 'failure') : created ? 'success' : 'skipped' };
    await deps.recordImport(result, source, startedAt).catch(error => log.error('[Conversions] History recording failed:', error));
    return result;
  });
}
