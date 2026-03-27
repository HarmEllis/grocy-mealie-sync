export function isBelowMinimumStock(currentStock: number, minStockAmount: number): boolean {
  return minStockAmount > 0 && currentStock < minStockAmount;
}
