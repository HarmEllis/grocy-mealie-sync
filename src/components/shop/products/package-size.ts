import { derivePackageBaseAmount } from '@/lib/shop/units';
import type { ShopProduct } from '../catalog-options';

/** The retailer's own package size, e.g. "200 g"; the thing that tells two products with one name apart. */
export function packageLabel(product: Pick<ShopProduct, 'measure' | 'packageAmount' | 'packageUnit'> | undefined): string | null {
  if (!product) return null;
  if (product.measure === 'weight') return 'per kg';
  return product.packageAmount && product.packageUnit ? `${product.packageAmount} ${product.packageUnit}` : null;
}

export interface PackageMismatch { expected: number; actual: number }

/**
 * Whether a mapped amount contradicts the retailer's package size when both are plain weights or volumes, e.g. a
 * 200 g package saved as 70 gram. Units the library cannot compare (cans, bags) are never judged here.
 */
export function packageMismatch(
  product: Pick<ShopProduct, 'measure' | 'packageAmount' | 'packageUnit'> | undefined,
  amount: number | null | undefined,
  baseUnitName: string | null | undefined,
): PackageMismatch | null {
  if (!product || !amount || amount <= 0) return null;
  const derived = derivePackageBaseAmount({
    measure: product.measure === 'weight' ? 'weight' : 'unit',
    packageAmount: product.packageAmount,
    packageUnit: product.packageUnit,
    baseUnitName: baseUnitName ?? null,
  });
  if (!derived) return null;
  // A package given in pieces says nothing about a weight, and the library only derives matching dimensions.
  return Math.abs(derived.amount - amount) > derived.amount * 0.01 ? { expected: derived.amount, actual: amount } : null;
}

/** Trim floating point noise for display: 2.857142857 becomes 2.857. */
export function formatAmount(value: number): string {
  return String(+value.toFixed(3));
}
