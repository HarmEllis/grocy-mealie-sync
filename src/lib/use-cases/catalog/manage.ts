import { defaultSyncLockDeps, runWithSyncLock, type SyncLockDeps } from '@/lib/use-cases/shared/sync-lock';
import {
  createGrocyEntity,
  deleteGrocyEntity,
  getGrocyEntities,
  getLocationStockEntries,
  updateGrocyEntity,
  type CreateLocationBody,
  type CreateProductGroupBody,
  type Location,
  type Product,
  type ProductGroup,
  type StockEntry,
  type UpdateLocationBody,
  type UpdateProductGroupBody,
} from '@/lib/grocy/types';

export interface GrocyLocationEntry {
  id: number;
  name: string;
  description: string | null;
}

export interface GrocyProductGroupEntry {
  id: number;
  name: string;
  description: string | null;
}

export interface GrocyLocationsResult {
  count: number;
  locations: GrocyLocationEntry[];
}

export interface GrocyProductGroupsResult {
  count: number;
  productGroups: GrocyProductGroupEntry[];
}

export interface CreateGrocyLocationParams {
  name: string;
  description?: string | null;
}

export interface CreateGrocyLocationResult {
  created: true;
  locationId: number;
  name: string;
  description: string | null;
}

export interface UpdateGrocyLocationParams {
  locationId: number;
  name?: string;
  description?: string | null;
}

export interface UpdateGrocyLocationResult {
  locationId: number;
  name: string;
  updated: {
    name?: string;
    description?: string | null;
  };
}

export interface DeleteGrocyLocationParams {
  locationId: number;
}

export type CatalogDeleteBlockerSource =
  | 'grocy_product_location'
  | 'grocy_product_consume_location'
  | 'grocy_stock_entry'
  | 'grocy_product_group_assignment';

export interface CatalogDeleteBlocker {
  source: CatalogDeleteBlockerSource;
  reference: string;
  message: string;
}

export interface DeleteGrocyLocationResult {
  deleted: boolean;
  blocked: boolean;
  locationId: number;
  name: string;
  blockers: CatalogDeleteBlocker[];
}

export interface CreateGrocyProductGroupParams {
  name: string;
  description?: string | null;
}

export interface CreateGrocyProductGroupResult {
  created: true;
  productGroupId: number;
  name: string;
  description: string | null;
}

export interface UpdateGrocyProductGroupParams {
  productGroupId: number;
  name?: string;
  description?: string | null;
}

export interface UpdateGrocyProductGroupResult {
  productGroupId: number;
  name: string;
  updated: {
    name?: string;
    description?: string | null;
  };
}

export interface DeleteGrocyProductGroupParams {
  productGroupId: number;
}

export interface DeleteGrocyProductGroupResult {
  deleted: boolean;
  blocked: boolean;
  productGroupId: number;
  name: string;
  blockers: CatalogDeleteBlocker[];
}

export interface CatalogManageDeps extends SyncLockDeps {
  listGrocyLocations(): Promise<Location[]>;
  createGrocyLocation(body: CreateLocationBody): Promise<{ createdObjectId: number }>;
  updateGrocyLocation(locationId: number, body: UpdateLocationBody): Promise<void>;
  deleteGrocyLocation(locationId: number): Promise<void>;
  listGrocyProducts(): Promise<Product[]>;
  listLocationStockEntries(locationId: number): Promise<StockEntry[]>;
  listGrocyProductGroups(): Promise<ProductGroup[]>;
  createGrocyProductGroup(body: CreateProductGroupBody): Promise<{ createdObjectId: number }>;
  updateGrocyProductGroup(productGroupId: number, body: UpdateProductGroupBody): Promise<void>;
  deleteGrocyProductGroup(productGroupId: number): Promise<void>;
}

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function requireName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0) {
    throw new Error('Name must not be empty.');
  }

  return normalized;
}

function toLocationEntry(location: Location): GrocyLocationEntry {
  return {
    id: Number(location.id ?? 0),
    name: location.name || 'Unknown',
    description: location.description || null,
  };
}

function toProductGroupEntry(group: ProductGroup): GrocyProductGroupEntry {
  return {
    id: Number(group.id ?? 0),
    name: group.name || 'Unknown',
    description: group.description || null,
  };
}

function requireLocation(locations: Location[], locationId: number): Location & { id: number } {
  const location = locations.find(entry => Number(entry.id) === locationId);
  if (!location || typeof location.id !== 'number') {
    throw new Error(`Grocy location #${locationId} was not found.`);
  }

  return {
    ...location,
    id: location.id,
  };
}

function requireProductGroup(groups: ProductGroup[], productGroupId: number): ProductGroup & { id: number } {
  const group = groups.find(entry => Number(entry.id) === productGroupId);
  if (!group || typeof group.id !== 'number') {
    throw new Error(`Grocy product group #${productGroupId} was not found.`);
  }

  return {
    ...group,
    id: group.id,
  };
}

function getLocationUsage(products: Product[], locationId: number) {
  const assignedProducts = products.filter(product =>
    Number(product.location_id ?? 0) === locationId
    || Number(product.default_consume_location_id ?? 0) === locationId,
  );

  return {
    assignedProducts,
  };
}

function getProductGroupUsage(products: Product[], productGroupId: number) {
  const assignedProducts = products.filter(product => Number(product.product_group_id ?? 0) === productGroupId);

  return {
    assignedProducts,
  };
}

function requireCatalogUpdate(
  targetLabel: string,
  updated: Record<string, unknown>,
) {
  if (Object.keys(updated).length === 0) {
    throw new Error(`Provide at least one field to update the ${targetLabel}.`);
  }
}

function buildLocationDeleteBlockers(
  locationId: number,
  usage: ReturnType<typeof getLocationUsage>,
  stockEntries: StockEntry[],
): CatalogDeleteBlocker[] {
  return [
    ...usage.assignedProducts.flatMap(product => {
      const productName = product.name || `#${product.id ?? 'unknown'}`;
      const blockers: CatalogDeleteBlocker[] = [];

      if (Number(product.location_id ?? 0) === locationId) {
        blockers.push({
          source: 'grocy_product_location',
          reference: `grocy-product:${product.id ?? 'unknown'}`,
          message: `Grocy product "${productName}" uses this location as its storage location.`,
        });
      }

      if (Number(product.default_consume_location_id ?? 0) === locationId) {
        blockers.push({
          source: 'grocy_product_consume_location',
          reference: `grocy-product:${product.id ?? 'unknown'}`,
          message: `Grocy product "${productName}" uses this location as its consume location.`,
        });
      }

      return blockers;
    }),
    ...stockEntries.map(entry => ({
      source: 'grocy_stock_entry' as const,
      reference: `stock-entry:${entry.id ?? 'unknown'}`,
      message: `Grocy stock entry #${entry.id ?? 'unknown'} is stored in this location.`,
    })),
  ];
}

function buildProductGroupDeleteBlockers(
  usage: ReturnType<typeof getProductGroupUsage>,
): CatalogDeleteBlocker[] {
  return usage.assignedProducts.map(product => ({
    source: 'grocy_product_group_assignment' as const,
    reference: `grocy-product:${product.id ?? 'unknown'}`,
    message: `Grocy product "${product.name || `#${product.id ?? 'unknown'}`}" is still assigned to this product group.`,
  }));
}

const defaultDeps: CatalogManageDeps = {
  ...defaultSyncLockDeps,
  listGrocyLocations: async () => getGrocyEntities('locations'),
  createGrocyLocation: async body => {
    const result = await createGrocyEntity('locations', body);
    const createdObjectId = Number(result.created_object_id ?? 0);
    if (!createdObjectId) {
      throw new Error('Grocy did not return a created location id.');
    }

    return { createdObjectId };
  },
  updateGrocyLocation: (locationId, body) => updateGrocyEntity('locations', locationId, body),
  deleteGrocyLocation: locationId => deleteGrocyEntity('locations', locationId),
  listGrocyProducts: async () => getGrocyEntities('products'),
  listLocationStockEntries: locationId => getLocationStockEntries(locationId),
  listGrocyProductGroups: async () => getGrocyEntities('product_groups'),
  createGrocyProductGroup: async body => {
    const result = await createGrocyEntity('product_groups', body);
    const createdObjectId = Number(result.created_object_id ?? 0);
    if (!createdObjectId) {
      throw new Error('Grocy did not return a created product group id.');
    }

    return { createdObjectId };
  },
  updateGrocyProductGroup: (productGroupId, body) => updateGrocyEntity('product_groups', productGroupId, body),
  deleteGrocyProductGroup: productGroupId => deleteGrocyEntity('product_groups', productGroupId),
};

export async function listGrocyLocations(
  deps: Pick<CatalogManageDeps, 'listGrocyLocations'> = defaultDeps,
): Promise<GrocyLocationsResult> {
  const entities = await deps.listGrocyLocations();
  const locations = entities
    .filter((entry): entry is Location & { id: number } => typeof entry.id === 'number')
    .map(toLocationEntry)
    .sort((left, right) => left.name.localeCompare(right.name));

  return { count: locations.length, locations };
}

export async function createGrocyLocation(
  params: CreateGrocyLocationParams,
  deps: Pick<CatalogManageDeps, 'acquireSyncLock' | 'releaseSyncLock' | 'createGrocyLocation'> = defaultDeps,
): Promise<CreateGrocyLocationResult> {
  return runWithSyncLock(deps, async () => {
    const name = requireName(params.name);
    const description = normalizeOptionalText(params.description);
    const { createdObjectId } = await deps.createGrocyLocation({
      name,
      ...(description !== null ? { description } : {}),
    });

    return {
      created: true,
      locationId: createdObjectId,
      name,
      description: description ?? null,
    };
  });
}

export async function updateGrocyLocation(
  params: UpdateGrocyLocationParams,
  deps: Pick<
    CatalogManageDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'listGrocyLocations' | 'updateGrocyLocation'
  > = defaultDeps,
): Promise<UpdateGrocyLocationResult> {
  return runWithSyncLock(deps, async () => {
    const existing = requireLocation(await deps.listGrocyLocations(), params.locationId);
    const update: UpdateLocationBody = {};
    const updated: UpdateGrocyLocationResult['updated'] = {};

    if (params.name !== undefined) {
      update.name = requireName(params.name);
      updated.name = update.name;
    }

    if (params.description !== undefined) {
      update.description = normalizeOptionalText(params.description) ?? null;
      updated.description = update.description;
    }

    requireCatalogUpdate('Grocy location', updated);
    await deps.updateGrocyLocation(params.locationId, update);

    return {
      locationId: params.locationId,
      name: updated.name ?? existing.name ?? 'Unknown',
      updated,
    };
  });
}

export async function deleteGrocyLocation(
  params: DeleteGrocyLocationParams,
  deps: Pick<
    CatalogManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'listGrocyLocations'
    | 'deleteGrocyLocation'
    | 'listGrocyProducts'
    | 'listLocationStockEntries'
  > = defaultDeps,
): Promise<DeleteGrocyLocationResult> {
  return runWithSyncLock(deps, async () => {
    const existing = requireLocation(await deps.listGrocyLocations(), params.locationId);
    const products = await deps.listGrocyProducts();
    const stockEntries = await deps.listLocationStockEntries(params.locationId);
    const usage = getLocationUsage(products, params.locationId);
    const blockers = buildLocationDeleteBlockers(params.locationId, usage, stockEntries);

    if (blockers.length > 0) {
      return {
        deleted: false,
        blocked: true,
        locationId: params.locationId,
        name: existing.name || 'Unknown',
        blockers,
      };
    }

    await deps.deleteGrocyLocation(params.locationId);

    return {
      deleted: true,
      blocked: false,
      locationId: params.locationId,
      name: existing.name || 'Unknown',
      blockers: [],
    };
  });
}

export async function listGrocyProductGroups(
  deps: Pick<CatalogManageDeps, 'listGrocyProductGroups'> = defaultDeps,
): Promise<GrocyProductGroupsResult> {
  const entities = await deps.listGrocyProductGroups();
  const productGroups = entities
    .filter((entry): entry is ProductGroup & { id: number } => typeof entry.id === 'number')
    .map(toProductGroupEntry)
    .sort((left, right) => left.name.localeCompare(right.name));

  return { count: productGroups.length, productGroups };
}

export async function createGrocyProductGroup(
  params: CreateGrocyProductGroupParams,
  deps: Pick<CatalogManageDeps, 'acquireSyncLock' | 'releaseSyncLock' | 'createGrocyProductGroup'> = defaultDeps,
): Promise<CreateGrocyProductGroupResult> {
  return runWithSyncLock(deps, async () => {
    const name = requireName(params.name);
    const description = normalizeOptionalText(params.description);
    const { createdObjectId } = await deps.createGrocyProductGroup({
      name,
      ...(description !== null ? { description } : {}),
    });

    return {
      created: true,
      productGroupId: createdObjectId,
      name,
      description: description ?? null,
    };
  });
}

export async function updateGrocyProductGroup(
  params: UpdateGrocyProductGroupParams,
  deps: Pick<
    CatalogManageDeps,
    'acquireSyncLock' | 'releaseSyncLock' | 'listGrocyProductGroups' | 'updateGrocyProductGroup'
  > = defaultDeps,
): Promise<UpdateGrocyProductGroupResult> {
  return runWithSyncLock(deps, async () => {
    const existing = requireProductGroup(await deps.listGrocyProductGroups(), params.productGroupId);
    const update: UpdateProductGroupBody = {};
    const updated: UpdateGrocyProductGroupResult['updated'] = {};

    if (params.name !== undefined) {
      update.name = requireName(params.name);
      updated.name = update.name;
    }

    if (params.description !== undefined) {
      update.description = normalizeOptionalText(params.description) ?? null;
      updated.description = update.description;
    }

    requireCatalogUpdate('Grocy product group', updated);
    await deps.updateGrocyProductGroup(params.productGroupId, update);

    return {
      productGroupId: params.productGroupId,
      name: updated.name ?? existing.name ?? 'Unknown',
      updated,
    };
  });
}

export async function deleteGrocyProductGroup(
  params: DeleteGrocyProductGroupParams,
  deps: Pick<
    CatalogManageDeps,
    | 'acquireSyncLock'
    | 'releaseSyncLock'
    | 'listGrocyProductGroups'
    | 'deleteGrocyProductGroup'
    | 'listGrocyProducts'
  > = defaultDeps,
): Promise<DeleteGrocyProductGroupResult> {
  return runWithSyncLock(deps, async () => {
    const existing = requireProductGroup(await deps.listGrocyProductGroups(), params.productGroupId);
    const usage = getProductGroupUsage(await deps.listGrocyProducts(), params.productGroupId);
    const blockers = buildProductGroupDeleteBlockers(usage);

    if (blockers.length > 0) {
      return {
        deleted: false,
        blocked: true,
        productGroupId: params.productGroupId,
        name: existing.name || 'Unknown',
        blockers,
      };
    }

    await deps.deleteGrocyProductGroup(params.productGroupId);

    return {
      deleted: true,
      blocked: false,
      productGroupId: params.productGroupId,
      name: existing.name || 'Unknown',
      blockers: [],
    };
  });
}
