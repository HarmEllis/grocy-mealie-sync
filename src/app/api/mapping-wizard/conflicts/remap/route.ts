import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getGrocyEntities, updateGrocyEntity } from '@/lib/grocy/types';
import { RecipesFoodsService, RecipesUnitsService } from '@/lib/mealie';
import { log } from '@/lib/logger';
import { resolveConflictsForMapping } from '@/lib/mapping-conflicts-store';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import {
  formatProductMappingConflictMessage,
  formatUnitMappingConflictMessage,
} from '@/lib/mapping-conflicts';
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';

const remapOptionsQuerySchema = z.object({
  mappingKind: z.enum(['product', 'unit']),
  mappingId: z.string().min(1),
});

const productConflictRemapSchema = z.object({
  mappingKind: z.literal('product'),
  mappingId: z.string().min(1),
  mealieFoodId: z.string().min(1),
  grocyProductId: z.number(),
  grocyUnitId: z.number().nullable(),
});

const unitConflictRemapSchema = z.object({
  mappingKind: z.literal('unit'),
  mappingId: z.string().min(1),
  mealieUnitId: z.string().min(1),
  grocyUnitId: z.number(),
});

const remapRequestSchema = z.discriminatedUnion('mappingKind', [
  productConflictRemapSchema,
  unitConflictRemapSchema,
]);

function extractItems<T extends Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) {
    return (value as { items: T[] }).items;
  }

  return [];
}

async function fetchMealieFoods() {
  const response = await RecipesFoodsService.getAllApiFoodsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
  );

  return extractItems<{ id?: string | null; name?: string | null }>(response)
    .filter(food => food.id)
    .map(food => ({
      id: food.id!,
      name: food.name || 'Unknown',
    }));
}

async function fetchMealieUnits() {
  const response = await RecipesUnitsService.getAllApiUnitsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
  );

  return extractItems<{
    id?: string | null;
    name?: string | null;
    abbreviation?: string | null;
    pluralName?: string | null;
  }>(response)
    .filter(unit => unit.id)
    .map(unit => ({
      id: unit.id!,
      name: unit.name || 'Unknown',
      abbreviation: unit.abbreviation || '',
      pluralName: unit.pluralName || '',
    }));
}

async function fetchGrocyProducts() {
  const grocyProducts = await getGrocyEntities('products');
  return grocyProducts.map(product => ({
    id: Number(product.id),
    name: product.name || 'Unknown',
    quIdPurchase: Number(product.qu_id_purchase || 0),
    minStockAmount: Number(product.min_stock_amount || 0),
  }));
}

async function fetchGrocyUnits() {
  const grocyUnits = await getGrocyEntities('quantity_units');
  return grocyUnits.map(unit => ({
    id: Number(unit.id),
    name: unit.name || 'Unknown',
  }));
}

function formatMealieFoodConflictMessage(conflict: {
  mealieFoodId: string;
  mealieFoodName?: string | null;
  grocyProductId: number;
  grocyProductName?: string | null;
}): string {
  const mealieName = conflict.mealieFoodName ? `"${conflict.mealieFoodName}"` : conflict.mealieFoodId;
  const grocyName = conflict.grocyProductName ? `"${conflict.grocyProductName}"` : `#${conflict.grocyProductId}`;
  return `Mealie food ${mealieName} is already mapped to Grocy product ${grocyName} (#${conflict.grocyProductId}).`;
}

function formatMealieUnitConflictMessage(conflict: {
  mealieUnitId: string;
  mealieUnitName?: string | null;
  grocyUnitId: number;
  grocyUnitName?: string | null;
}): string {
  const mealieName = conflict.mealieUnitName ? `"${conflict.mealieUnitName}"` : conflict.mealieUnitId;
  const grocyName = conflict.grocyUnitName ? `"${conflict.grocyUnitName}"` : `#${conflict.grocyUnitId}`;
  return `Mealie unit ${mealieName} is already mapped to Grocy unit ${grocyName} (#${conflict.grocyUnitId}).`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = remapOptionsQuerySchema.safeParse({
    mappingKind: url.searchParams.get('mappingKind'),
    mappingId: url.searchParams.get('mappingId'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.mappingKind === 'product') {
      const [existingMappings, mealieFoods, grocyProducts, grocyUnits, existingUnitMappings] = await Promise.all([
        db.select().from(productMappings),
        fetchMealieFoods(),
        fetchGrocyProducts(),
        fetchGrocyUnits(),
        db.select().from(unitMappings),
      ]);

      const mapping = existingMappings.find(row => row.id === parsed.data.mappingId);
      if (!mapping) {
        return NextResponse.json({ error: 'Product mapping not found' }, { status: 404 });
      }

      const currentUnitMapping = mapping.unitMappingId
        ? existingUnitMappings.find(unitMapping => unitMapping.id === mapping.unitMappingId)
        : null;

      return NextResponse.json({
        mappingKind: 'product',
        currentSelection: {
          mealieFoodId: mapping.mealieFoodId,
          grocyProductId: mapping.grocyProductId,
          grocyUnitId: currentUnitMapping?.grocyUnitId ?? null,
        },
        mealieFoods,
        grocyProducts,
        grocyUnits,
      });
    }

    const [existingMappings, mealieUnits, grocyUnits] = await Promise.all([
      db.select().from(unitMappings),
      fetchMealieUnits(),
      fetchGrocyUnits(),
    ]);

    const mapping = existingMappings.find(row => row.id === parsed.data.mappingId);
    if (!mapping) {
      return NextResponse.json({ error: 'Unit mapping not found' }, { status: 404 });
    }

    return NextResponse.json({
      mappingKind: 'unit',
      currentSelection: {
        mealieUnitId: mapping.mealieUnitId,
        grocyUnitId: mapping.grocyUnitId,
      },
      mealieUnits,
      grocyUnits,
    });
  } catch (error) {
    log.error('[MappingWizard] Failed to fetch remap options:', error);
    return NextResponse.json({ error: 'Failed to fetch remap options' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  const history = createManualHistoryRecorder(
    'conflict_remap',
    '[History] Failed to record conflict remap:',
  );

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = remapRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    if (payload.mappingKind === 'product') {
      const [existingMappings, existingUnitMappings, mealieFoods, grocyProducts, grocyUnits] = await Promise.all([
        db.select().from(productMappings),
        db.select().from(unitMappings),
        fetchMealieFoods(),
        fetchGrocyProducts(),
        fetchGrocyUnits(),
      ]);

      const mapping = existingMappings.find(row => row.id === payload.mappingId);
      if (!mapping) {
        return NextResponse.json({ error: 'Product mapping not found' }, { status: 404 });
      }

      const mealieFood = mealieFoods.find(food => food.id === payload.mealieFoodId);
      if (!mealieFood) {
        return NextResponse.json({ error: 'Selected Mealie product not found' }, { status: 404 });
      }

      const grocyProduct = grocyProducts.find(product => product.id === payload.grocyProductId);
      if (!grocyProduct) {
        return NextResponse.json({ error: 'Selected Grocy product not found' }, { status: 404 });
      }

      if (payload.grocyUnitId !== null) {
        const grocyUnit = grocyUnits.find(unit => unit.id === payload.grocyUnitId);
        if (!grocyUnit) {
          return NextResponse.json({ error: 'Selected Grocy unit not found' }, { status: 404 });
        }
      }

      const mealieConflict = existingMappings.find(existing =>
        existing.id !== payload.mappingId && existing.mealieFoodId === payload.mealieFoodId,
      );
      if (mealieConflict) {
        return NextResponse.json(
          {
            error: formatMealieFoodConflictMessage(mealieConflict),
            conflict: {
              mealieFoodId: payload.mealieFoodId,
              mappingId: mealieConflict.id,
            },
          },
          { status: 409 },
        );
      }

      const grocyConflict = existingMappings.find(existing =>
        existing.id !== payload.mappingId && existing.grocyProductId === payload.grocyProductId,
      );
      if (grocyConflict) {
        return NextResponse.json(
          {
            error: formatProductMappingConflictMessage(grocyConflict, payload.grocyProductId),
            conflict: {
              grocyProductId: payload.grocyProductId,
              mappingId: grocyConflict.id,
            },
          },
          { status: 409 },
        );
      }

      const nextUnitMapping = payload.grocyUnitId === null
        ? null
        : existingUnitMappings.find(unitMapping => unitMapping.grocyUnitId === payload.grocyUnitId) ?? null;
      const now = new Date();
      let effectiveGrocyProductName = grocyProduct.name;

      if (grocyProduct.name !== mealieFood.name) {
        try {
          await updateGrocyEntity('products', grocyProduct.id, { name: mealieFood.name });
          effectiveGrocyProductName = mealieFood.name;
        } catch (error) {
          log.error(`[MappingWizard] Failed to rename Grocy product ${grocyProduct.id} during conflict remap:`, error);
        }
      }

      await db.update(productMappings)
        .set({
          mealieFoodId: mealieFood.id,
          mealieFoodName: mealieFood.name,
          grocyProductId: grocyProduct.id,
          grocyProductName: effectiveGrocyProductName,
          unitMappingId: nextUnitMapping?.id ?? null,
          updatedAt: now,
        })
        .where(eq(productMappings.id, payload.mappingId));

      await resolveConflictsForMapping('product', payload.mappingId);

      await history.record({
        status: 'success',
        message: `Resolved product conflict for mapping ${payload.mappingId}.`,
        summary: {
          mappingKind: 'product',
          mappingId: payload.mappingId,
          mealieFoodId: payload.mealieFoodId,
          grocyProductId: payload.grocyProductId,
          grocyUnitId: payload.grocyUnitId,
        },
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'conflict',
            entityKind: 'product',
            entityRef: payload.mappingId,
            message: `Resolved product conflict for mapping ${payload.mappingId}.`,
            details: {
              mealieFoodId: payload.mealieFoodId,
              grocyProductId: payload.grocyProductId,
              grocyUnitId: payload.grocyUnitId,
            },
          }),
        ],
      });

      return NextResponse.json({
        status: 'ok',
        mappingKind: 'product',
        mappingId: payload.mappingId,
      });
    }

    const [existingMappings, mealieUnits, grocyUnits] = await Promise.all([
      db.select().from(unitMappings),
      fetchMealieUnits(),
      fetchGrocyUnits(),
    ]);

    const mapping = existingMappings.find(row => row.id === payload.mappingId);
    if (!mapping) {
      return NextResponse.json({ error: 'Unit mapping not found' }, { status: 404 });
    }

    const mealieUnit = mealieUnits.find(unit => unit.id === payload.mealieUnitId);
    if (!mealieUnit) {
      return NextResponse.json({ error: 'Selected Mealie unit not found' }, { status: 404 });
    }

    const grocyUnit = grocyUnits.find(unit => unit.id === payload.grocyUnitId);
    if (!grocyUnit) {
      return NextResponse.json({ error: 'Selected Grocy unit not found' }, { status: 404 });
    }

    const mealieConflict = existingMappings.find(existing =>
      existing.id !== payload.mappingId && existing.mealieUnitId === payload.mealieUnitId,
    );
    if (mealieConflict) {
      return NextResponse.json(
        {
          error: formatMealieUnitConflictMessage(mealieConflict),
          conflict: {
            mealieUnitId: payload.mealieUnitId,
            mappingId: mealieConflict.id,
          },
        },
        { status: 409 },
      );
    }

    const grocyConflict = existingMappings.find(existing =>
      existing.id !== payload.mappingId && existing.grocyUnitId === payload.grocyUnitId,
    );
    if (grocyConflict) {
      return NextResponse.json(
        {
          error: formatUnitMappingConflictMessage(grocyConflict, payload.grocyUnitId),
          conflict: {
            grocyUnitId: payload.grocyUnitId,
            mappingId: grocyConflict.id,
          },
        },
        { status: 409 },
      );
    }

    const now = new Date();

    if (grocyUnit.name !== mealieUnit.name) {
      try {
        await updateGrocyEntity('quantity_units', grocyUnit.id, {
          name: mealieUnit.name,
          name_plural: mealieUnit.pluralName || mealieUnit.name,
        });
      } catch (error) {
        log.error(`[MappingWizard] Failed to rename Grocy unit ${grocyUnit.id} during conflict remap:`, error);
      }
    }

    await db.update(unitMappings)
      .set({
        mealieUnitId: mealieUnit.id,
        mealieUnitName: mealieUnit.name,
        mealieUnitAbbreviation: mealieUnit.abbreviation,
        grocyUnitId: grocyUnit.id,
        grocyUnitName: grocyUnit.name,
        updatedAt: now,
      })
      .where(eq(unitMappings.id, payload.mappingId));

    await resolveConflictsForMapping('unit', payload.mappingId);

    await history.record({
      status: 'success',
      message: `Resolved unit conflict for mapping ${payload.mappingId}.`,
      summary: {
        mappingKind: 'unit',
        mappingId: payload.mappingId,
        mealieUnitId: payload.mealieUnitId,
        grocyUnitId: payload.grocyUnitId,
      },
      events: [
        buildManualHistoryEvent({
          level: 'info',
          category: 'conflict',
          entityKind: 'unit',
          entityRef: payload.mappingId,
          message: `Resolved unit conflict for mapping ${payload.mappingId}.`,
          details: {
            mealieUnitId: payload.mealieUnitId,
            grocyUnitId: payload.grocyUnitId,
          },
        }),
      ],
    });

    return NextResponse.json({
      status: 'ok',
      mappingKind: 'unit',
      mappingId: payload.mappingId,
    });
  } catch (error) {
    log.error('[MappingWizard] Conflict remap failed:', error);
    await history.record({
      status: 'failure',
      message: `Conflict remap failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'conflict',
          message: 'Conflict remap failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Failed to remap conflict' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
