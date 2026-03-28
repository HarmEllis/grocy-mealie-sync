import {
  addProductStock as addProductStockToGrocy,
  consumeProductStock as consumeProductStockFromGrocy,
  getProductDetails,
  inventoryProductStock as inventoryProductStockInGrocy,
  openProductStock as openProductStockInGrocy,
  type ProductDetailsResponse,
} from '@/lib/grocy/types';
import { getProductOverview, type ProductOverview } from '@/lib/use-cases/products/catalog';
import { defaultSyncLockDeps, runWithSyncLock, type SyncLockDeps } from '@/lib/use-cases/shared/sync-lock';

export interface InventoryStockParams {
  productRef: string;
}

export interface InventoryStockSnapshot {
  productRef: string;
  grocyProductId: number;
  name: string;
  currentStock: number;
  openedStock: number;
  unopenedStock: number;
  minStockAmount: number;
  isBelowMinimum: boolean;
  treatOpenedAsOutOfStock: boolean;
  nextDueDate: string | null;
  defaultBestBeforeDays: number | null;
  defaultBestBeforeDaysAfterOpen: number | null;
  shouldNotBeFrozen: boolean;
}

export interface AddStockParams {
  productRef: string;
  amount: number;
  bestBeforeDate?: string | null;
  note?: string | null;
}

export interface AddStockResult {
  productRef: string;
  grocyProductId: number;
  name: string;
  amount: number;
  bestBeforeDate: string | null;
  note: string | null;
}

export interface ConsumeStockParams {
  productRef: string;
  amount: number;
  spoiled?: boolean;
  exactAmount?: boolean;
}

export interface ConsumeStockResult {
  productRef: string;
  grocyProductId: number;
  name: string;
  amount: number;
  spoiled: boolean;
  exactAmount: boolean;
}

export interface SetStockParams {
  productRef: string;
  amount: number;
  bestBeforeDate?: string | null;
  note?: string | null;
}

export interface SetStockResult {
  productRef: string;
  grocyProductId: number;
  name: string;
  amount: number;
  bestBeforeDate: string | null;
  note: string | null;
}

export interface MarkStockOpenedParams {
  productRef: string;
  amount?: number;
}

export interface MarkStockOpenedResult {
  productRef: string;
  grocyProductId: number;
  name: string;
  amount: number;
}

export interface InventoryDeps extends SyncLockDeps {
  getProductOverview(params: InventoryStockParams): Promise<ProductOverview>;
  getProductDetails(productId: number): Promise<ProductDetailsResponse>;
  addProductStock(
    productId: number,
    input: {
      amount: number;
      bestBeforeDate?: string | null;
      note?: string | null;
    },
  ): Promise<void>;
  consumeProductStock(
    productId: number,
    input: {
      amount: number;
      spoiled?: boolean;
      exactAmount?: boolean;
    },
  ): Promise<void>;
  inventoryProductStock(
    productId: number,
    input: {
      newAmount: number;
      bestBeforeDate?: string | null;
      note?: string | null;
    },
  ): Promise<void>;
  openProductStock(
    productId: number,
    input: {
      amount: number;
    },
  ): Promise<void>;
}

const defaultDeps: InventoryDeps = {
  ...defaultSyncLockDeps,
  getProductOverview,
  getProductDetails,
  addProductStock: addProductStockToGrocy,
  consumeProductStock: consumeProductStockFromGrocy,
  inventoryProductStock: inventoryProductStockInGrocy,
  openProductStock: openProductStockInGrocy,
};

function requireGrocyProduct(overview: ProductOverview): NonNullable<ProductOverview['grocyProduct']> {
  if (!overview.grocyProduct) {
    throw new Error(`Product ${overview.productRef} does not exist in Grocy.`);
  }

  return overview.grocyProduct;
}

function ensurePositiveAmount(amount: number, label = 'Amount') {
  if (!(amount > 0)) {
    throw new Error(`${label} must be greater than 0.`);
  }
}

function toInventoryStockSnapshot(
  overview: ProductOverview,
  details: ProductDetailsResponse,
): InventoryStockSnapshot {
  const grocyProduct = requireGrocyProduct(overview);
  const openedStock = Number(details.stock_amount_opened ?? 0);
  const currentStock = Number(details.stock_amount ?? grocyProduct.currentStock ?? 0);

  return {
    productRef: overview.productRef,
    grocyProductId: grocyProduct.id,
    name: grocyProduct.name,
    currentStock,
    openedStock,
    unopenedStock: Math.max(0, currentStock - openedStock),
    minStockAmount: grocyProduct.minStockAmount,
    isBelowMinimum: grocyProduct.isBelowMinimum,
    treatOpenedAsOutOfStock: grocyProduct.treatOpenedAsOutOfStock,
    nextDueDate: details.next_due_date ?? null,
    defaultBestBeforeDays: grocyProduct.defaultBestBeforeDays,
    defaultBestBeforeDaysAfterOpen: grocyProduct.defaultBestBeforeDaysAfterOpen,
    shouldNotBeFrozen: grocyProduct.shouldNotBeFrozen,
  };
}

export async function getInventoryStock(
  params: InventoryStockParams,
  deps: Pick<InventoryDeps, 'getProductOverview' | 'getProductDetails'> = defaultDeps,
): Promise<InventoryStockSnapshot> {
  const overview = await deps.getProductOverview({ productRef: params.productRef });
  const grocyProduct = requireGrocyProduct(overview);
  const details = await deps.getProductDetails(grocyProduct.id);
  return toInventoryStockSnapshot(overview, details);
}

export async function addStock(
  params: AddStockParams,
  deps: Pick<
    InventoryDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'getProductOverview' | 'addProductStock'
  > = defaultDeps,
): Promise<AddStockResult> {
  ensurePositiveAmount(params.amount);

  return runWithSyncLock(deps, async () => {
    const overview = await deps.getProductOverview({ productRef: params.productRef });
    const grocyProduct = requireGrocyProduct(overview);

    await deps.addProductStock(grocyProduct.id, {
      amount: params.amount,
      bestBeforeDate: params.bestBeforeDate ?? null,
      note: params.note ?? null,
    });

    return {
      productRef: params.productRef,
      grocyProductId: grocyProduct.id,
      name: grocyProduct.name,
      amount: params.amount,
      bestBeforeDate: params.bestBeforeDate ?? null,
      note: params.note ?? null,
    };
  });
}

export async function consumeStock(
  params: ConsumeStockParams,
  deps: Pick<
    InventoryDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'getProductOverview' | 'consumeProductStock'
  > = defaultDeps,
): Promise<ConsumeStockResult> {
  ensurePositiveAmount(params.amount);

  return runWithSyncLock(deps, async () => {
    const overview = await deps.getProductOverview({ productRef: params.productRef });
    const grocyProduct = requireGrocyProduct(overview);
    const spoiled = params.spoiled ?? false;
    const exactAmount = params.exactAmount ?? false;

    await deps.consumeProductStock(grocyProduct.id, {
      amount: params.amount,
      spoiled,
      exactAmount,
    });

    return {
      productRef: params.productRef,
      grocyProductId: grocyProduct.id,
      name: grocyProduct.name,
      amount: params.amount,
      spoiled,
      exactAmount,
    };
  });
}

export async function setStock(
  params: SetStockParams,
  deps: Pick<
    InventoryDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'getProductOverview' | 'inventoryProductStock'
  > = defaultDeps,
): Promise<SetStockResult> {
  if (params.amount < 0) {
    throw new Error('Amount must be 0 or greater.');
  }

  return runWithSyncLock(deps, async () => {
    const overview = await deps.getProductOverview({ productRef: params.productRef });
    const grocyProduct = requireGrocyProduct(overview);

    await deps.inventoryProductStock(grocyProduct.id, {
      newAmount: params.amount,
      bestBeforeDate: params.bestBeforeDate ?? null,
      note: params.note ?? null,
    });

    return {
      productRef: params.productRef,
      grocyProductId: grocyProduct.id,
      name: grocyProduct.name,
      amount: params.amount,
      bestBeforeDate: params.bestBeforeDate ?? null,
      note: params.note ?? null,
    };
  });
}

export async function markStockOpened(
  params: MarkStockOpenedParams,
  deps: Pick<
    InventoryDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'getProductOverview' | 'openProductStock'
  > = defaultDeps,
): Promise<MarkStockOpenedResult> {
  const amount = params.amount ?? 1;
  ensurePositiveAmount(amount);

  return runWithSyncLock(deps, async () => {
    const overview = await deps.getProductOverview({ productRef: params.productRef });
    const grocyProduct = requireGrocyProduct(overview);

    await deps.openProductStock(grocyProduct.id, { amount });

    return {
      productRef: params.productRef,
      grocyProductId: grocyProduct.id,
      name: grocyProduct.name,
      amount,
    };
  });
}
