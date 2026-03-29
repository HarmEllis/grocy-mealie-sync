import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getCurrentStock, getGrocyEntities, getVolatileStock, inventoryProductStock, updateGrocyEntity } from '@/lib/grocy/types';
import { log } from '@/lib/logger';
import { resolveMappingWizardMinStockStep } from '@/lib/settings';
import { mappedProductStockUpdateSchema } from '@/lib/validation';

export async function GET() {
  try {
    const [mappings, mappedUnits, grocyProducts, grocyUnits, currentStock, volatileStock, minStockStep] = await Promise.all([
      db.select({
        id: productMappings.id,
        mealieFoodName: productMappings.mealieFoodName,
        grocyProductId: productMappings.grocyProductId,
        grocyProductName: productMappings.grocyProductName,
        unitMappingId: productMappings.unitMappingId,
      }).from(productMappings),
      db.select({
        id: unitMappings.id,
        mealieUnitName: unitMappings.mealieUnitName,
        grocyUnitName: unitMappings.grocyUnitName,
      }).from(unitMappings),
      getGrocyEntities('products'),
      getGrocyEntities('quantity_units'),
      getCurrentStock(),
      getVolatileStock(),
      resolveMappingWizardMinStockStep(),
    ]);

    const grocyProductById = new Map(grocyProducts.map(product => [Number(product.id), product]));
    const unitMappingById = new Map(mappedUnits.map(unit => [unit.id, unit]));
    const grocyUnitById = new Map(grocyUnits.map(unit => [Number(unit.id), unit.name || 'Unknown']));
    const stockByProductId = new Map(currentStock.map(stock => [
      Number(stock.product_id),
      Number(stock.amount_aggregated ?? stock.amount ?? 0),
    ]));
    const missingProductIds = new Set((volatileStock.missing_products ?? []).map(product => Number(product.id)));

    const mappedProducts = mappings
      .map(mapping => {
        const grocyProduct = grocyProductById.get(mapping.grocyProductId);
        const unitMapping = mapping.unitMappingId ? unitMappingById.get(mapping.unitMappingId) : undefined;
        const fallbackGrocyUnitName = grocyProduct?.qu_id_purchase
          ? grocyUnitById.get(Number(grocyProduct.qu_id_purchase))
          : undefined;

        return {
          id: mapping.id,
          grocyProductId: mapping.grocyProductId,
          name: mapping.mealieFoodName || grocyProduct?.name || mapping.grocyProductName,
          unitName: unitMapping?.mealieUnitName || unitMapping?.grocyUnitName || fallbackGrocyUnitName || '-',
          currentStock: stockByProductId.get(mapping.grocyProductId) ?? 0,
          minStockAmount: Number(grocyProduct?.min_stock_amount ?? 0),
          isBelowMinimum: missingProductIds.has(mapping.grocyProductId),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    return NextResponse.json({ mappedProducts, minStockStep });
  } catch (error) {
    log.error('[MappingWizard] Failed to fetch mapped products:', error);
    return NextResponse.json({ error: 'Failed to fetch mapped products' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = mappedProductStockUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.minStockAmount !== undefined) {
      await updateGrocyEntity('products', parsed.data.grocyProductId, {
        min_stock_amount: parsed.data.minStockAmount,
      });
    }

    if (parsed.data.currentStock !== undefined) {
      await inventoryProductStock(parsed.data.grocyProductId, {
        newAmount: parsed.data.currentStock,
      });
    }

    return NextResponse.json({
      status: 'ok',
      grocyProductId: parsed.data.grocyProductId,
      ...(parsed.data.minStockAmount !== undefined ? { minStockAmount: parsed.data.minStockAmount } : {}),
      ...(parsed.data.currentStock !== undefined ? { currentStock: parsed.data.currentStock } : {}),
    });
  } catch (error) {
    log.error(`[MappingWizard] Failed to update stock values for Grocy product ${parsed.data.grocyProductId}:`, error);
    return NextResponse.json({ error: 'Failed to update Grocy stock values' }, { status: 500 });
  }
}
