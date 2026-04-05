import type {
  AddStockParams,
  AddStockResult,
  CreateInventoryEntryParams,
  CreateInventoryEntryResult,
  ConsumeStockParams,
  ConsumeStockResult,
  DeleteInventoryEntryParams,
  DeleteInventoryEntryResult,
  GetInventoryEntryParams,
  GetInventoryEntryResult,
  InventoryStockParams,
  InventoryStockSnapshot,
  InventoryStockEntriesParams,
  InventoryStockEntriesResult,
  MarkStockOpenedParams,
  MarkStockOpenedResult,
  SetStockParams,
  SetStockResult,
  UpdateInventoryEntryParams,
  UpdateInventoryEntryResult,
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
  ProductListParams,
  ProductListResult,
} from '@/lib/use-cases/products/list';
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
  DeleteProductParams,
  DeleteProductResult,
  UpdateProductUnitsParams,
  UpdateProductUnitsResult,
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
  UpdateShoppingListItemParams,
  UpdateShoppingListItemResult,
  UpdateShoppingItemUnitParams,
  UpdateShoppingItemUnitResult,
} from '@/lib/use-cases/shopping/list';
import type {
  CreateUnitConversionParams,
  CreateUnitConversionResult,
  DeleteUnitConversionParams,
  DeleteUnitConversionResult,
  ListConversionsResult,
} from '@/lib/use-cases/conversions/manage';
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
  CreateGrocyUnitParams,
  CreateGrocyUnitResult,
  CreateMealieUnitParams,
  CreateMealieUnitResult,
  DeleteGrocyUnitParams,
  DeleteGrocyUnitResult,
  DeleteMealieUnitParams,
  DeleteMealieUnitResult,
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
import type {
  CreateGrocyLocationParams,
  CreateGrocyLocationResult,
  CreateGrocyProductGroupParams,
  CreateGrocyProductGroupResult,
  DeleteGrocyLocationParams,
  DeleteGrocyLocationResult,
  DeleteGrocyProductGroupParams,
  DeleteGrocyProductGroupResult,
  GrocyLocationsResult,
  GrocyProductGroupsResult,
  UpdateGrocyLocationParams,
  UpdateGrocyLocationResult,
  UpdateGrocyProductGroupParams,
  UpdateGrocyProductGroupResult,
} from '@/lib/use-cases/catalog/manage';

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
  listProducts(params: ProductListParams): Promise<ProductListResult>;
  updateGrocyStockSettings(params: UpdateGrocyStockSettingsParams): Promise<UpdateGrocyStockSettingsResult>;
  createProductInGrocy(params: CreateProductInGrocyParams): Promise<CreateProductInGrocyResult>;
  createProductInMealie(params: CreateProductInMealieParams): Promise<CreateProductInMealieResult>;
  createProductInBoth(params: CreateProductInBothParams): Promise<CreateProductInBothResult>;
  updateBasicProduct(params: UpdateBasicProductParams): Promise<UpdateBasicProductResult>;
  deleteProduct(params: DeleteProductParams): Promise<DeleteProductResult>;
  updateProductUnits(params: UpdateProductUnitsParams): Promise<UpdateProductUnitsResult>;
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
  updateShoppingListItem(params: UpdateShoppingListItemParams): Promise<UpdateShoppingListItemResult>;
  updateShoppingItemUnit(params: UpdateShoppingItemUnitParams): Promise<UpdateShoppingItemUnitResult>;
  mergeShoppingListDuplicates(params: MergeShoppingListDuplicatesParams): Promise<MergeShoppingListDuplicatesResult>;
}

export interface InventoryMcpServices {
  getInventoryStock(params: InventoryStockParams): Promise<InventoryStockSnapshot>;
  listLowStockProductsResource(): Promise<LowStockProductsResource>;
  listInventoryEntries(params: InventoryStockEntriesParams): Promise<InventoryStockEntriesResult>;
  getInventoryEntry(params: GetInventoryEntryParams): Promise<GetInventoryEntryResult>;
  addStock(params: AddStockParams): Promise<AddStockResult>;
  consumeStock(params: ConsumeStockParams): Promise<ConsumeStockResult>;
  setStock(params: SetStockParams): Promise<SetStockResult>;
  markStockOpened(params: MarkStockOpenedParams): Promise<MarkStockOpenedResult>;
  deleteInventoryEntry(params: DeleteInventoryEntryParams): Promise<DeleteInventoryEntryResult>;
  createInventoryEntry(params: CreateInventoryEntryParams): Promise<CreateInventoryEntryResult>;
  updateInventoryEntry(params: UpdateInventoryEntryParams): Promise<UpdateInventoryEntryResult>;
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
  createGrocyUnit(params: CreateGrocyUnitParams): Promise<CreateGrocyUnitResult>;
  createMealieUnit(params: CreateMealieUnitParams): Promise<CreateMealieUnitResult>;
  compareUnits(params: CompareUnitsParams): Promise<CompareUnitsResult>;
  normalizeMappedUnits(): Promise<NormalizeMappedUnitsResult>;
  updateGrocyUnitMetadata(params: UpdateGrocyUnitMetadataParams): Promise<UpdateGrocyUnitMetadataResult>;
  updateMealieUnitMetadata(params: UpdateMealieUnitMetadataParams): Promise<UpdateMealieUnitMetadataResult>;
  deleteGrocyUnit(params: DeleteGrocyUnitParams): Promise<DeleteGrocyUnitResult>;
  deleteMealieUnit(params: DeleteMealieUnitParams): Promise<DeleteMealieUnitResult>;
}

export interface ConversionMcpServices {
  listConversions(): Promise<ListConversionsResult>;
  createUnitConversion(params: CreateUnitConversionParams): Promise<CreateUnitConversionResult>;
  deleteUnitConversion(params: DeleteUnitConversionParams): Promise<DeleteUnitConversionResult>;
}

export interface HistoryMcpServices {
  listRecentHistoryResource(params?: ListRecentHistoryParams): Promise<RecentHistoryResource>;
  getHistoryRunResource(params: GetHistoryRunParams): Promise<HistoryRunResource>;
}

export interface ConflictMcpServices {
  listOpenMappingConflictsResource(): Promise<OpenMappingConflictsResource>;
}

export interface CatalogMcpServices {
  listGrocyLocations(): Promise<GrocyLocationsResult>;
  listGrocyProductGroups(): Promise<GrocyProductGroupsResult>;
  createGrocyLocation(params: CreateGrocyLocationParams): Promise<CreateGrocyLocationResult>;
  updateGrocyLocation(params: UpdateGrocyLocationParams): Promise<UpdateGrocyLocationResult>;
  deleteGrocyLocation(params: DeleteGrocyLocationParams): Promise<DeleteGrocyLocationResult>;
  createGrocyProductGroup(params: CreateGrocyProductGroupParams): Promise<CreateGrocyProductGroupResult>;
  updateGrocyProductGroup(params: UpdateGrocyProductGroupParams): Promise<UpdateGrocyProductGroupResult>;
  deleteGrocyProductGroup(params: DeleteGrocyProductGroupParams): Promise<DeleteGrocyProductGroupResult>;
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
  conversions: ConversionMcpServices;
  history: HistoryMcpServices;
  conflicts: ConflictMcpServices;
  diagnostics: DiagnosticsMcpServices;
  catalog: CatalogMcpServices;
}

export interface GrocyMealieSyncMcpServiceOverrides {
  products?: Partial<ProductMcpServices>;
  resources?: Partial<ResourceMcpServices>;
  shopping?: Partial<ShoppingMcpServices>;
  inventory?: Partial<InventoryMcpServices>;
  mappings?: Partial<MappingMcpServices>;
  units?: Partial<UnitMcpServices>;
  conversions?: Partial<ConversionMcpServices>;
  history?: Partial<HistoryMcpServices>;
  conflicts?: Partial<ConflictMcpServices>;
  diagnostics?: Partial<DiagnosticsMcpServices>;
  catalog?: Partial<CatalogMcpServices>;
}
