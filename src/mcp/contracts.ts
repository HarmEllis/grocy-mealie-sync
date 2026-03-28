import type {
  AddStockParams,
  AddStockResult,
  ConsumeStockParams,
  ConsumeStockResult,
  InventoryStockParams,
  InventoryStockSnapshot,
  MarkStockOpenedParams,
  MarkStockOpenedResult,
  SetStockParams,
  SetStockResult,
} from '@/lib/use-cases/inventory/manage';
import type {
  ProductDuplicateCheckParams,
  ProductDuplicateCheckResult,
  ProductOverview,
  ProductOverviewParams,
  ProductSearchParams,
  ProductSearchResult,
} from '@/lib/use-cases/products/catalog';
import type {
  CreateProductInGrocyParams,
  CreateProductInGrocyResult,
  CreateProductInMealieParams,
  CreateProductInMealieResult,
  CreateProductInBothParams,
  CreateProductInBothResult,
  UpdateBasicProductParams,
  UpdateBasicProductResult,
  UpdateGrocyStockSettingsParams,
  UpdateGrocyStockSettingsResult,
} from '@/lib/use-cases/products/manage';
import type {
  LowStockProductsResource,
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
  MergeShoppingListDuplicatesParams,
  MergeShoppingListDuplicatesResult,
  RemoveShoppingListItemParams,
  RemoveShoppingListItemResult,
  ShoppingListItemsResource,
} from '@/lib/use-cases/shopping/list';
import type {
  RemoveProductMappingParams,
  RemoveProductMappingResult,
  RemoveUnitMappingParams,
  RemoveUnitMappingResult,
  UpsertProductMappingParams,
  UpsertProductMappingResult,
  UpsertUnitMappingParams,
  UpsertUnitMappingResult,
} from '@/lib/use-cases/mappings/manage';
import type {
  SuggestProductMappingsResult,
  SuggestUnitMappingsResult,
} from '@/lib/use-cases/mappings/suggestions';
import type {
  CompareUnitsParams,
  CompareUnitsResult,
  NormalizeMappedUnitsResult,
  UnitCatalogResource,
  UpdateGrocyUnitMetadataParams,
  UpdateGrocyUnitMetadataResult,
  UpdateMealieUnitMetadataParams,
  UpdateMealieUnitMetadataResult,
} from '@/lib/use-cases/units/manage';
import type {
  GetHistoryRunParams,
  HistoryRunResource,
  ListRecentHistoryParams,
  RecentHistoryResource,
} from '@/lib/use-cases/history/read';
import type {
  ExplainProductStateParams,
  ProductStateExplanation,
} from '@/lib/use-cases/diagnostics/explain';

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
  updateGrocyStockSettings(params: UpdateGrocyStockSettingsParams): Promise<UpdateGrocyStockSettingsResult>;
  createProductInGrocy(params: CreateProductInGrocyParams): Promise<CreateProductInGrocyResult>;
  createProductInMealie(params: CreateProductInMealieParams): Promise<CreateProductInMealieResult>;
  createProductInBoth(params: CreateProductInBothParams): Promise<CreateProductInBothResult>;
  updateBasicProduct(params: UpdateBasicProductParams): Promise<UpdateBasicProductResult>;
}

export interface ResourceMcpServices {
  getStatusResource(): Promise<McpStatusResource>;
  listProductMappingsResource(): Promise<ProductMappingsResource>;
  listUnitMappingsResource(): Promise<UnitMappingsResource>;
  listUnmappedProductsResource(): Promise<UnmappedProductsResource>;
  listUnmappedUnitsResource(): Promise<UnmappedUnitsResource>;
  listOpenMappingConflictsResource(): Promise<OpenMappingConflictsResource>;
  getShoppingListItemsResource(): Promise<ShoppingListItemsResource>;
  listLowStockProductsResource(): Promise<LowStockProductsResource>;
  getUnitCatalogResource(): Promise<UnitCatalogResource>;
  listRecentHistoryResource(): Promise<RecentHistoryResource>;
  getHistoryRunResource(params: GetHistoryRunParams): Promise<HistoryRunResource>;
}

export interface ShoppingMcpServices {
  getShoppingListItemsResource(): Promise<ShoppingListItemsResource>;
  checkShoppingListProduct(params: CheckShoppingListProductParams): Promise<CheckShoppingListProductResult>;
  addShoppingListItem(params: AddShoppingListItemParams): Promise<AddShoppingListItemResult>;
  removeShoppingListItem(params: RemoveShoppingListItemParams): Promise<RemoveShoppingListItemResult>;
  mergeShoppingListDuplicates(params: MergeShoppingListDuplicatesParams): Promise<MergeShoppingListDuplicatesResult>;
}

export interface InventoryMcpServices {
  getInventoryStock(params: InventoryStockParams): Promise<InventoryStockSnapshot>;
  listLowStockProductsResource(): Promise<LowStockProductsResource>;
  addStock(params: AddStockParams): Promise<AddStockResult>;
  consumeStock(params: ConsumeStockParams): Promise<ConsumeStockResult>;
  setStock(params: SetStockParams): Promise<SetStockResult>;
  markStockOpened(params: MarkStockOpenedParams): Promise<MarkStockOpenedResult>;
}

export interface MappingMcpServices {
  listProductMappingsResource(): Promise<ProductMappingsResource>;
  listUnitMappingsResource(): Promise<UnitMappingsResource>;
  listUnmappedProductsResource(): Promise<UnmappedProductsResource>;
  listUnmappedUnitsResource(): Promise<UnmappedUnitsResource>;
  suggestProductMappings(): Promise<SuggestProductMappingsResult>;
  suggestUnitMappings(): Promise<SuggestUnitMappingsResult>;
  upsertProductMapping(params: UpsertProductMappingParams): Promise<UpsertProductMappingResult>;
  removeProductMapping(params: RemoveProductMappingParams): Promise<RemoveProductMappingResult>;
  upsertUnitMapping(params: UpsertUnitMappingParams): Promise<UpsertUnitMappingResult>;
  removeUnitMapping(params: RemoveUnitMappingParams): Promise<RemoveUnitMappingResult>;
}

export interface UnitMcpServices {
  getUnitCatalog(): Promise<UnitCatalogResource>;
  compareUnits(params: CompareUnitsParams): Promise<CompareUnitsResult>;
  normalizeMappedUnits(): Promise<NormalizeMappedUnitsResult>;
  updateGrocyUnitMetadata(params: UpdateGrocyUnitMetadataParams): Promise<UpdateGrocyUnitMetadataResult>;
  updateMealieUnitMetadata(params: UpdateMealieUnitMetadataParams): Promise<UpdateMealieUnitMetadataResult>;
}

export interface HistoryMcpServices {
  listRecentHistoryResource(params?: ListRecentHistoryParams): Promise<RecentHistoryResource>;
  getHistoryRunResource(params: GetHistoryRunParams): Promise<HistoryRunResource>;
}

export interface ConflictMcpServices {
  listOpenMappingConflictsResource(): Promise<OpenMappingConflictsResource>;
}

export interface DiagnosticsMcpServices {
  explainProductState(params: ExplainProductStateParams): Promise<ProductStateExplanation>;
}

export interface GrocyMealieSyncMcpServices {
  products: ProductMcpServices;
  resources: ResourceMcpServices;
  shopping: ShoppingMcpServices;
  inventory: InventoryMcpServices;
  mappings: MappingMcpServices;
  units: UnitMcpServices;
  history: HistoryMcpServices;
  conflicts: ConflictMcpServices;
  diagnostics: DiagnosticsMcpServices;
}

export interface GrocyMealieSyncMcpServiceOverrides {
  products?: Partial<ProductMcpServices>;
  resources?: Partial<ResourceMcpServices>;
  shopping?: Partial<ShoppingMcpServices>;
  inventory?: Partial<InventoryMcpServices>;
  mappings?: Partial<MappingMcpServices>;
  units?: Partial<UnitMcpServices>;
  history?: Partial<HistoryMcpServices>;
  conflicts?: Partial<ConflictMcpServices>;
  diagnostics?: Partial<DiagnosticsMcpServices>;
}
