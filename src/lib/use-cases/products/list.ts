import { db } from '@/lib/db';
import { productMappings } from '@/lib/db/schema';
import {
  getCurrentStock,
  getGrocyEntities,
  getVolatileStock,
  type CurrentStockResponse,
  type GrocyMissingProduct,
  type Product,
} from '@/lib/grocy/types';
import type { ProductMappingRecord } from './catalog';

export interface ProductListParams {
  scope?: 'all' | 'mapped';
  stockGt?: number;
  hasMinStock?: boolean;
  belowMinimum?: boolean;
  locationId?: number;
  productGroupId?: number;
  noOwnStock?: boolean;
  shouldNotBeFrozen?: boolean;
}

export interface ProductListEntry {
  productRef: string;
  grocyProductId: number;
  grocyProductName: string;
  mapped: boolean;
  mealieFoodId: string | null;
  mealieFoodName: string | null;
  currentStock: number;
  minStockAmount: number;
  isBelowMinimum: boolean;
  locationId: number | null;
  productGroupId: number | null;
  noOwnStock: boolean;
  shouldNotBeFrozen: boolean;
}

export interface ProductListResult {
  count: number;
  products: ProductListEntry[];
}

export interface ProductListDeps {
  listProductMappings(): Promise<ProductMappingRecord[]>;
  listGrocyProducts(): Promise<Product[]>;
  getCurrentStock(): Promise<CurrentStockResponse[]>;
  getVolatileStock(): Promise<{ missing_products?: GrocyMissingProduct[] }>;
}

const defaultDeps: ProductListDeps = {
  listProductMappings: async () => db.select().from(productMappings),
  listGrocyProducts: async () => getGrocyEntities('products'),
  getCurrentStock,
  getVolatileStock,
};

function buildCurrentStockMap(currentStock: CurrentStockResponse[]): Map<number, number> {
  return new Map(currentStock.map(entry => [
    Number(entry.product_id),
    Number(entry.amount_aggregated ?? entry.amount ?? 0),
  ]));
}

function buildBelowMinimumSet(missingProducts: GrocyMissingProduct[] | undefined): Set<number> {
  return new Set((missingProducts ?? []).map(product => Number(product.id)));
}

export async function listProducts(
  params: ProductListParams = {},
  deps: ProductListDeps = defaultDeps,
): Promise<ProductListResult> {
  const scope = params.scope ?? 'mapped';
  const [mappings, grocyProducts, currentStock, volatileStock] = await Promise.all([
    deps.listProductMappings(),
    deps.listGrocyProducts(),
    deps.getCurrentStock(),
    deps.getVolatileStock(),
  ]);

  const mappingByGrocyId = new Map(mappings.map(m => [m.grocyProductId, m]));
  const currentStockByProductId = buildCurrentStockMap(currentStock);
  const belowMinimumIds = buildBelowMinimumSet(volatileStock.missing_products);

  let candidates = grocyProducts.filter((p): p is Product & { id: number } => typeof p.id === 'number');

  if (scope === 'mapped') {
    candidates = candidates.filter(p => mappingByGrocyId.has(p.id!));
  }

  const products: ProductListEntry[] = candidates
    .map(product => {
      const productId = product.id!;
      const mapping = mappingByGrocyId.get(productId);

      return {
        productRef: mapping ? `mapping:${mapping.id}` : `grocy:${productId}`,
        grocyProductId: productId,
        grocyProductName: product.name || 'Unknown',
        mapped: !!mapping,
        mealieFoodId: mapping?.mealieFoodId ?? null,
        mealieFoodName: mapping?.mealieFoodName ?? null,
        currentStock: currentStockByProductId.get(productId) ?? 0,
        minStockAmount: Number(product.min_stock_amount ?? 0),
        isBelowMinimum: belowMinimumIds.has(productId),
        locationId: product.location_id ?? null,
        productGroupId: product.product_group_id ?? null,
        noOwnStock: Boolean(product.no_own_stock),
        shouldNotBeFrozen: Boolean(product.should_not_be_frozen),
      };
    })
    .filter(entry => {
      if (params.stockGt !== undefined && entry.currentStock <= params.stockGt) {
        return false;
      }
      if (params.hasMinStock === true && entry.minStockAmount <= 0) {
        return false;
      }
      if (params.belowMinimum === true && !entry.isBelowMinimum) {
        return false;
      }
      if (params.locationId !== undefined && entry.locationId !== params.locationId) {
        return false;
      }
      if (params.productGroupId !== undefined && entry.productGroupId !== params.productGroupId) {
        return false;
      }
      if (params.noOwnStock === true && !entry.noOwnStock) {
        return false;
      }
      if (params.shouldNotBeFrozen === true && !entry.shouldNotBeFrozen) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.grocyProductName.localeCompare(b.grocyProductName));

  return {
    count: products.length,
    products,
  };
}
