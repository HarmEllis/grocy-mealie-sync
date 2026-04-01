import {
  createGrocyEntity,
  deleteGrocyEntity,
  getGrocyEntities,
  type CreateQuantityUnitConversionBody,
  type QuantityUnit,
  type QuantityUnitConversion,
} from '@/lib/grocy/types';
import { defaultSyncLockDeps, runWithSyncLock, type SyncLockDeps } from '@/lib/use-cases/shared/sync-lock';

export interface ConversionEntry {
  id: number;
  fromUnitId: number;
  fromUnitName: string;
  toUnitId: number;
  toUnitName: string;
  factor: number;
  grocyProductId: number | null;
}

export interface ListConversionsResult {
  conversions: ConversionEntry[];
}

export interface CreateUnitConversionParams {
  fromGrocyUnitId: number;
  toGrocyUnitId: number;
  factor: number;
  grocyProductId?: number | null;
}

export interface CreateUnitConversionResult {
  created: boolean;
  conversionId: number | null;
  fromGrocyUnitId: number;
  toGrocyUnitId: number;
  factor: number;
  grocyProductId: number | null;
  duplicateCheck?: {
    skipped: boolean;
    existingConversionId: number;
    reverseConversion?: boolean;
  };
}

export interface DeleteUnitConversionParams {
  conversionId: number;
}

export interface DeleteUnitConversionResult {
  deleted: boolean;
  conversionId: number;
}

export interface ConversionManageDeps extends SyncLockDeps {
  listGrocyConversions(): Promise<QuantityUnitConversion[]>;
  listGrocyUnits(): Promise<QuantityUnit[]>;
  createGrocyConversion(body: CreateQuantityUnitConversionBody): Promise<{ created_object_id: number }>;
  deleteGrocyConversion(conversionId: number): Promise<void>;
}

const defaultDeps: ConversionManageDeps = {
  ...defaultSyncLockDeps,
  listGrocyConversions: async () => getGrocyEntities('quantity_unit_conversions'),
  listGrocyUnits: async () => getGrocyEntities('quantity_units'),
  createGrocyConversion: async body => {
    const result = await createGrocyEntity('quantity_unit_conversions', body as unknown as Record<string, unknown>);
    const createdObjectId = Number(result.created_object_id ?? 0);

    if (!createdObjectId) {
      throw new Error('Grocy did not return a created conversion id.');
    }

    return { created_object_id: createdObjectId };
  },
  deleteGrocyConversion: conversionId => deleteGrocyEntity('quantity_unit_conversions', conversionId),
};

function buildUnitNameMap(units: QuantityUnit[]): Map<number, string> {
  return new Map(
    units.map(unit => [Number(unit.id ?? 0), unit.name || 'Unknown']),
  );
}

function toConversionEntry(
  conversion: QuantityUnitConversion,
  unitNameMap: Map<number, string>,
): ConversionEntry {
  const fromUnitId = Number(conversion.from_qu_id ?? 0);
  const toUnitId = Number(conversion.to_qu_id ?? 0);

  return {
    id: Number(conversion.id ?? 0),
    fromUnitId,
    fromUnitName: unitNameMap.get(fromUnitId) ?? 'Unknown',
    toUnitId,
    toUnitName: unitNameMap.get(toUnitId) ?? 'Unknown',
    factor: Number(conversion.factor ?? 0),
    grocyProductId: conversion.product_id != null ? Number(conversion.product_id) : null,
  };
}

export async function listConversions(
  deps: Pick<ConversionManageDeps, 'listGrocyConversions' | 'listGrocyUnits'> = defaultDeps,
): Promise<ListConversionsResult> {
  const [conversions, units] = await Promise.all([
    deps.listGrocyConversions(),
    deps.listGrocyUnits(),
  ]);

  const unitNameMap = buildUnitNameMap(units);

  return {
    conversions: conversions.map(c => toConversionEntry(c, unitNameMap)),
  };
}

export async function createUnitConversion(
  params: CreateUnitConversionParams,
  deps: Pick<
    ConversionManageDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'listGrocyConversions' | 'createGrocyConversion'
  > = defaultDeps,
): Promise<CreateUnitConversionResult> {
  return runWithSyncLock(deps, async () => {
    const existingConversions = await deps.listGrocyConversions();
    const productId = params.grocyProductId ?? null;

    const duplicate = existingConversions.find(
      c => c.from_qu_id === params.fromGrocyUnitId
        && c.to_qu_id === params.toGrocyUnitId
        && (c.product_id ?? null) === productId,
    );

    if (duplicate) {
      return {
        created: false,
        conversionId: Number(duplicate.id ?? 0) || null,
        fromGrocyUnitId: params.fromGrocyUnitId,
        toGrocyUnitId: params.toGrocyUnitId,
        factor: params.factor,
        grocyProductId: productId,
        duplicateCheck: {
          skipped: true,
          existingConversionId: Number(duplicate.id ?? 0),
        },
      };
    }

    const reverse = existingConversions.find(
      c => c.from_qu_id === params.toGrocyUnitId
        && c.to_qu_id === params.fromGrocyUnitId
        && (c.product_id ?? null) === productId,
    );

    if (reverse) {
      return {
        created: false,
        conversionId: Number(reverse.id ?? 0) || null,
        fromGrocyUnitId: params.fromGrocyUnitId,
        toGrocyUnitId: params.toGrocyUnitId,
        factor: params.factor,
        grocyProductId: productId,
        duplicateCheck: {
          skipped: true,
          existingConversionId: Number(reverse.id ?? 0),
          reverseConversion: true,
        },
      };
    }

    const payload: CreateQuantityUnitConversionBody = {
      from_qu_id: params.fromGrocyUnitId,
      to_qu_id: params.toGrocyUnitId,
      factor: params.factor,
      ...(productId !== null ? { product_id: productId } : {}),
    };

    const { created_object_id } = await deps.createGrocyConversion(payload);

    return {
      created: true,
      conversionId: created_object_id,
      fromGrocyUnitId: params.fromGrocyUnitId,
      toGrocyUnitId: params.toGrocyUnitId,
      factor: params.factor,
      grocyProductId: productId,
    };
  });
}

export async function deleteUnitConversion(
  params: DeleteUnitConversionParams,
  deps: Pick<
    ConversionManageDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'deleteGrocyConversion'
  > = defaultDeps,
): Promise<DeleteUnitConversionResult> {
  return runWithSyncLock(deps, async () => {
    await deps.deleteGrocyConversion(params.conversionId);

    return {
      deleted: true,
      conversionId: params.conversionId,
    };
  });
}
