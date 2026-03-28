import type {
  ProductDuplicateCheckParams,
  ProductDuplicateCheckResult,
  ProductOverview,
  ProductOverviewParams,
  ProductSearchParams,
  ProductSearchResult,
} from '@/lib/use-cases/products/catalog';
import type {
  McpStatusResource,
  OpenMappingConflictsResource,
  ProductMappingsResource,
  UnitMappingsResource,
  UnmappedProductsResource,
  UnmappedUnitsResource,
} from '@/lib/use-cases/resources/read-models';
import type {
  AddShoppingListItemParams,
  AddShoppingListItemResult,
  CheckShoppingListProductParams,
  CheckShoppingListProductResult,
  RemoveShoppingListItemParams,
  RemoveShoppingListItemResult,
  ShoppingListItemsResource,
} from '@/lib/use-cases/shopping/list';

export interface McpActionResult<TData = unknown> {
  [key: string]: unknown;
  ok: boolean;
  status: 'ok' | 'partial' | 'skipped' | 'busy' | 'error';
  message: string;
  data?: TData;
}

export interface ProductMcpServices {
  searchProducts(params: ProductSearchParams): Promise<ProductSearchResult>;
  getProductOverview(params: ProductOverviewParams): Promise<ProductOverview>;
  checkProductDuplicates(params: ProductDuplicateCheckParams): Promise<ProductDuplicateCheckResult>;
}

export interface ResourceMcpServices {
  getStatusResource(): Promise<McpStatusResource>;
  listProductMappingsResource(): Promise<ProductMappingsResource>;
  listUnitMappingsResource(): Promise<UnitMappingsResource>;
  listUnmappedProductsResource(): Promise<UnmappedProductsResource>;
  listUnmappedUnitsResource(): Promise<UnmappedUnitsResource>;
  listOpenMappingConflictsResource(): Promise<OpenMappingConflictsResource>;
  getShoppingListItemsResource(): Promise<ShoppingListItemsResource>;
}

export interface ShoppingMcpServices {
  getShoppingListItemsResource(): Promise<ShoppingListItemsResource>;
  checkShoppingListProduct(params: CheckShoppingListProductParams): Promise<CheckShoppingListProductResult>;
  addShoppingListItem(params: AddShoppingListItemParams): Promise<AddShoppingListItemResult>;
  removeShoppingListItem(params: RemoveShoppingListItemParams): Promise<RemoveShoppingListItemResult>;
}

export interface GrocyMealieSyncMcpServices {
  products: ProductMcpServices;
  resources: ResourceMcpServices;
  shopping: ShoppingMcpServices;
}
