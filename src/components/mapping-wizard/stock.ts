export function isBelowMinimumStock(
  currentStock: number,
  minStockAmount: number,
  isBelowMinimumOverride?: boolean,
): boolean {
  if (isBelowMinimumOverride !== undefined) {
    return isBelowMinimumOverride;
  }

  return minStockAmount > 0 && currentStock < minStockAmount;
}
