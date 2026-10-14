import type { MealieShoppingItem } from '../mealie/types';
import { isCountUnitName } from '../shop/units';

/** A shopping row's unit: Mealie may send only the nested unit without `unitId`. */
export function shoppingItemUnitId(item: Pick<MealieShoppingItem, 'unitId' | 'unit'>): string | null {
  return item.unitId || item.unit?.id || null;
}

/** The Mealie unit a product's stock amounts are written in, and how many stock units one of it holds. */
export interface StockUnitLabel {
  unitId: string | undefined;
  factor: number;
  emptyMeansStock: boolean;
}

/**
 * The Mealie unit for a Grocy stock unit. `mapping` is the unit mapping of the
 * stock unit, if any. `emptyMeansStock` applies the rule check-off uses for rows
 * without a unit: purchase and stock unit agree, or the stock unit counts pieces
 * ("Stuk"); the stock unit name is only loaded when that last check is needed.
 * Without a valid mapping the row gets no unit, but only where an empty unit
 * means the stock unit. Returns null when no unambiguous label exists.
 */
export async function resolveStockUnitLabelFor(input: {
  quIdStock: number;
  quIdPurchase: number;
  stockUnitName: () => Promise<string | undefined>;
  mapping: { mealieUnitId: string | null; conversionFactor: number } | undefined;
}): Promise<StockUnitLabel | null> {
  const { quIdStock, quIdPurchase, mapping } = input;
  if (!(quIdStock > 0)) return null;
  const emptyMeansStock = !(quIdPurchase > 0) || quIdPurchase === quIdStock
    || isCountUnitName(await input.stockUnitName());
  const factor = Number(mapping?.conversionFactor ?? 1);
  if (mapping?.mealieUnitId && Number.isFinite(factor) && factor > 0) {
    return { unitId: mapping.mealieUnitId, factor, emptyMeansStock };
  }
  return emptyMeansStock ? { unitId: undefined, factor: 1, emptyMeansStock } : null;
}

/** A stock amount expressed in the label's Mealie unit; significant digits, so a small amount never rounds to zero. */
export function toStockLabelQuantity(label: StockUnitLabel, stockAmount: number): number {
  return label.factor === 1 ? stockAmount : Number((stockAmount / label.factor).toPrecision(12));
}
