import { describe, expect, it, vi } from 'vitest';
import { LIBRARY_ENTRIES, STANDARD_SCALES, standardScale } from '@/lib/conversions/catalog';
import { previewConversionImport, importConversionLibrary, type LibraryDeps } from '../library';

function setup() {
  const state = { grocyUnits: [] as Array<{ id: number; name: string }>,
    mealieUnits: [] as Array<{ id: string; name: string; standardQuantity?: number; standardUnit?: string }>,
    mappings: [] as Array<{ id: string; mealieUnitId: string; grocyUnitId: number; conversionFactor: number }>,
    conversions: [] as Array<{ id: number; from_qu_id: number; to_qu_id: number; factor: number; product_id?: number | null }> };
  const deps: LibraryDeps = {
    acquireSyncLock: vi.fn(() => true), releaseSyncLock: vi.fn(),
    readState: vi.fn(async () => structuredClone(state)),
    getMealieUnit: vi.fn(async id => structuredClone(state.mealieUnits.find(unit => unit.id === id)!)),
    listMappings: vi.fn(async () => structuredClone(state.mappings)),
    listConversions: vi.fn(async () => structuredClone(state.conversions)),
    createGrocyUnit: vi.fn(async body => { const id = state.grocyUnits.length + 1; state.grocyUnits.push({ id, name: body.name }); return id; }),
    createMealieUnit: vi.fn(async body => { const unit = { ...body, id: `m-${state.mealieUnits.length + 1}` }; state.mealieUnits.push(unit); return unit; }),
    standardizeMealie: vi.fn(async (id, scale, unit) => { Object.assign(state.mealieUnits.find(u => u.id === id)!, { standardQuantity: scale, standardUnit: unit }); }),
    createMapping: vi.fn(async (mealie, grocy) => { const id = `map-${state.mappings.length}`; state.mappings.push({ id, mealieUnitId: mealie.id, grocyUnitId: grocy.id, conversionFactor: 1 }); return id; }),
    createConversion: vi.fn(async (from, to, factor) => { const id = state.conversions.length + 1; state.conversions.push({ id, from_qu_id: from, to_qu_id: to, factor }, { id: id + 1, from_qu_id: to, to_qu_id: from, factor: 1 / factor }); return id; }),
    recordImport: vi.fn(async () => {}),
  };
  return { state, deps };
}
const selection = { entryIds: ['kilogram-to-gram'], createMissingUnits: true };

describe('shared conversion library', () => {
  it('keeps reference factors precise and recognizes equivalent Mealie standards', () => {
    expect(LIBRARY_ENTRIES.find(e => e.from.id === 'liter')?.factor).toBe(1000);
    expect(LIBRARY_ENTRIES.find(e => e.from.id === 'us-pound')?.factor).toBe(453.59237);
    expect(standardScale('kilogram', 1)).toEqual({ dimension: 'mass', scale: 1000 });
    expect(standardScale('gram', 0)).toBeNull();
    expect(Object.keys(STANDARD_SCALES).sort()).toEqual(['cup', 'fluid_ounce', 'gram', 'kilogram', 'liter', 'milliliter', 'ounce', 'pound']);
    expect(LIBRARY_ENTRIES.find(e => e.from.id === 'us-tablespoon')?.from.aliases).not.toContain('eetlepel');
  });
  it('previews both systems without writes and imports once, including Grocy inverse records', async () => {
    const { deps } = setup();
    const preview = await previewConversionImport(selection, deps);
    expect(preview.canImport).toBe(true);
    expect(preview.counts).toMatchObject({ units: 4, mappings: 2, conversions: 1 });
    expect(deps.createGrocyUnit).not.toHaveBeenCalled();
    const result = await importConversionLibrary({ ...selection, fingerprint: preview.fingerprint }, deps);
    expect(result.status).toBe('success');
    const next = await previewConversionImport(selection, deps);
    expect(next.counts).toMatchObject({ units: 0, mappings: 0, conversions: 0, available: 1 });
    await importConversionLibrary({ ...selection, fingerprint: next.fingerprint }, deps);
    expect(deps.createConversion).toHaveBeenCalledTimes(1);
    expect(deps.readState).toHaveBeenCalledTimes(4);
  });
  it('blocks name collisions and non-identity mappings before writing', async () => {
    const { state, deps } = setup();
    state.mealieUnits.push({ id: 'm-1', name: 'Kilogram' });
    state.grocyUnits.push({ id: 1, name: 'Kilogram' });
    const collision = await previewConversionImport({ ...selection, bindings: { kilogram: { createMealie: true, createGrocy: true } } }, deps);
    expect(collision.units.find(u => u.unit.id === 'kilogram')?.problems.join(' ')).toContain('already exists');
    state.mappings.push({ id: 'map-1', mealieUnitId: 'm-1', grocyUnitId: 1, conversionFactor: 1000 });
    const conflict = await previewConversionImport(selection, deps);
    expect(conflict.units.find(u => u.unit.id === 'kilogram')?.problems.join(' ')).toContain('mapping conflicts');
    expect(deps.createGrocyUnit).not.toHaveBeenCalled();
  });
  it('resolves an ambiguous Mealie name using an equivalent native standard', async () => {
    const { state, deps } = setup();
    state.mealieUnits.push({ id: 'cup-1', name: 'Cup', standardUnit: 'cup', standardQuantity: 1 });
    const preview = await previewConversionImport({ entryIds: ['us-cup-to-milliliter'], createMissingUnits: true }, deps);
    expect(preview.units.find(u => u.unit.id === 'us-cup')?.mealie?.id).toBe('cup-1');
    expect(preview.canImport).toBe(true);
  });
  it('stops dependent setup if Mealie creates a unit with unexpected standardization', async () => {
    const { state, deps } = setup();
    vi.mocked(deps.createMealieUnit).mockImplementation(async body => {
      const unit = { ...body, id: `m-${state.mealieUnits.length + 1}`, standardQuantity: body.standardQuantity * 2 };
      state.mealieUnits.push(unit); return unit;
    });
    const preview = await previewConversionImport(selection, deps);
    const result = await importConversionLibrary({ ...selection, fingerprint: preview.fingerprint }, deps);
    expect(result.steps.some(s => s.status === 'failed' && s.message.includes('unexpected standardization'))).toBe(true);
    expect(deps.createGrocyUnit).not.toHaveBeenCalled();
    expect(deps.createMapping).not.toHaveBeenCalled();
    expect(deps.createConversion).not.toHaveBeenCalled();
  });
  it('reports unrecognized Mealie standards separately from different factors', async () => {
    const { state, deps } = setup();
    state.mealieUnits.push({ id: 'm-1', name: 'Kilogram', standardUnit: 'future-unit', standardQuantity: 1 });
    const preview = await previewConversionImport(selection, deps);
    expect(preview.units.find(u => u.unit.id === 'kilogram')?.problems.join(' ')).toContain('unrecognized standard unit');
  });
  it('blocks an ambiguous cup until explicitly bound', async () => {
    const { state, deps } = setup();
    state.grocyUnits.push({ id: 1, name: 'Cup' });
    const input = { entryIds: ['us-cup-to-milliliter'], target: 'grocy' as const, createMissingUnits: true };
    const preview = await previewConversionImport(input, deps);
    expect(preview.canImport).toBe(false);
    const bound = await previewConversionImport({ ...input, bindings: { 'us-cup': { grocyUnitId: 1 } } }, deps);
    expect(bound.canImport).toBe(true);
  });
  it('preserves Mealie definitions that conflict with a preset', async () => {
    const { state, deps } = setup();
    state.mealieUnits.push({ id: 'm-1', name: 'Kilogram', standardUnit: 'gram', standardQuantity: 500 });
    const preview = await previewConversionImport(selection, deps);
    expect(preview.canImport).toBe(false);
    expect(preview.units.find(u => u.unit.id === 'kilogram')?.problems.join(' ')).toContain('500');
  });
  it('rejects stale previews before writing', async () => {
    const { state, deps } = setup();
    const preview = await previewConversionImport(selection, deps);
    state.grocyUnits.push({ id: 1, name: 'Kilogram' });
    await expect(importConversionLibrary({ ...selection, fingerprint: preview.fingerprint }, deps)).rejects.toMatchObject({ code: 'PREVIEW_STALE' });
    expect(deps.createGrocyUnit).not.toHaveBeenCalled();
    expect(deps.releaseSyncLock).toHaveBeenCalledOnce();
  });
  it('blocks shared import on old Mealie versions while allowing Grocy-only setup', async () => {
    const { state, deps } = setup();
    vi.mocked(deps.readState).mockImplementation(async () => ({ ...structuredClone(state), mealieStandardization: false }));
    expect((await previewConversionImport(selection, deps)).canImport).toBe(false);
    const preview = await previewConversionImport({ ...selection, target: 'grocy' }, deps);
    expect(preview.canImport).toBe(true);
    await importConversionLibrary({ ...selection, target: 'grocy', fingerprint: preview.fingerprint }, deps);
    expect(deps.readState).toHaveBeenLastCalledWith('grocy');
    expect(deps.createMealieUnit).not.toHaveBeenCalled();
    expect(deps.createMapping).not.toHaveBeenCalled();
  });
  it('stops dependent writes when Mealie silently drops standardization', async () => {
    const { state, deps } = setup();
    state.mealieUnits.push({ id: 'm-1', name: 'Gram' }, { id: 'm-2', name: 'Kilogram' });
    vi.mocked(deps.standardizeMealie).mockResolvedValue(undefined);
    const preview = await previewConversionImport(selection, deps);
    const result = await importConversionLibrary({ ...selection, fingerprint: preview.fingerprint }, deps);
    expect(result.status).toBe('partial');
    expect(result.steps.some(s => s.status === 'failed' && s.message.includes('did not retain'))).toBe(true);
    expect(deps.createMapping).not.toHaveBeenCalled();
    expect(deps.createConversion).not.toHaveBeenCalled();
  });
  it('recognizes indirect equivalence and leaves product-specific overrides intact', async () => {
    const { state, deps } = setup();
    state.grocyUnits.push({ id: 1, name: 'Kilogram' }, { id: 2, name: 'Gram' }, { id: 3, name: 'Intermediate' });
    state.conversions.push({ id: 1, from_qu_id: 1, to_qu_id: 3, factor: 2 }, { id: 2, from_qu_id: 3, to_qu_id: 2, factor: 500 }, { id: 3, from_qu_id: 1, to_qu_id: 2, factor: 25, product_id: 9 });
    const preview = await previewConversionImport({ ...selection, target: 'grocy' }, deps);
    expect(preview.entries[0].status).toBe('already_available');
    expect(preview.counts.conversions).toBe(0);
  });
  it('blocks conflicting reverse factors and inconsistent existing paths', async () => {
    const { state, deps } = setup();
    state.grocyUnits.push({ id: 1, name: 'Kilogram' }, { id: 2, name: 'Gram' });
    state.conversions.push({ id: 1, from_qu_id: 2, to_qu_id: 1, factor: 0.002 });
    const preview = await previewConversionImport({ ...selection, target: 'grocy' }, deps);
    expect(preview.entries[0]).toMatchObject({ status: 'conflict', existingFactor: 500 });
  });
  it('retains completed writes after a failure and releases the lock', async () => {
    const { deps } = setup();
    vi.mocked(deps.createConversion).mockRejectedValueOnce(new Error('Grocy unavailable'));
    const preview = await previewConversionImport(selection, deps);
    const result = await importConversionLibrary({ ...selection, fingerprint: preview.fingerprint }, deps);
    expect(result.status).toBe('partial');
    expect(result.created).toBe(6);
    expect(result.failed).toBe(1);
    expect(deps.recordImport).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial' }), 'manual', expect.any(Date));
    expect(deps.releaseSyncLock).toHaveBeenCalledOnce();
    const retry = await previewConversionImport(selection, deps);
    expect(retry.counts).toMatchObject({ units: 0, mappings: 0, conversions: 1 });
    await importConversionLibrary({ ...selection, fingerprint: retry.fingerprint }, deps);
    expect(deps.createGrocyUnit).toHaveBeenCalledTimes(2);
    expect(deps.createMealieUnit).toHaveBeenCalledTimes(2);
    expect(deps.createConversion).toHaveBeenCalledTimes(2);
  });
  it('rejects unit reuse across distinct definitions', async () => {
    const { state, deps } = setup();
    state.grocyUnits.push({ id: 1, name: 'Measurement' });
    const preview = await previewConversionImport({ ...selection, target: 'grocy', bindings: { kilogram: { grocyUnitId: 1 }, gram: { grocyUnitId: 1 } } }, deps);
    expect(preview.canImport).toBe(false);
  });
});
