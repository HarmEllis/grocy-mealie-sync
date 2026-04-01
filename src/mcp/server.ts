import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import packageJson from '../../package.json';
import {
  addStock,
  consumeStock,
  getInventoryStock,
  markStockOpened,
  setStock,
} from '@/lib/use-cases/inventory/manage';
import {
  getHistoryRunResource,
  listRecentHistoryResource,
} from '@/lib/use-cases/history/read';
import {
  removeProductMapping,
  removeUnitMapping,
  upsertProductMapping,
  upsertUnitMapping,
} from '@/lib/use-cases/mappings/manage';
import {
  suggestProductMappings,
  suggestUnitMappings,
} from '@/lib/use-cases/mappings/suggestions';
import {
  checkProductDuplicates,
  getProductOverview,
  searchProducts,
} from '@/lib/use-cases/products/catalog';
import {
  createProductInGrocy,
  createProductInMealie,
  createProductInBoth,
  updateBasicProduct,
  updateGrocyStockSettings,
  deleteProduct,
  updateProductUnits,
} from '@/lib/use-cases/products/manage';
import {
  getStatusResource,
  listLowStockProductsResource,
  listOpenMappingConflictsResource,
  listProductMappingsResource,
  listUnitMappingsResource,
  listUnmappedProductsResource,
  listUnmappedUnitsResource,
} from '@/lib/use-cases/resources/read-models';
import {
  addShoppingListItem,
  checkShoppingListProduct,
  getShoppingListItemsResource,
  mergeShoppingListDuplicates,
  removeShoppingListItem,
  updateShoppingListItem,
  updateShoppingItemUnit,
} from '@/lib/use-cases/shopping/list';
import {
  compareUnits,
  createGrocyUnit,
  createMealieUnit,
  getUnitCatalog,
  normalizeMappedUnits,
  updateGrocyUnitMetadata,
  updateMealieUnitMetadata,
} from '@/lib/use-cases/units/manage';
import {
  createUnitConversion,
  deleteUnitConversion,
  listConversions,
} from '@/lib/use-cases/conversions/manage';
import { explainProductState } from '@/lib/use-cases/diagnostics/explain';
import type { GrocyMealieSyncMcpServiceOverrides, GrocyMealieSyncMcpServices } from './contracts';
import {
  createHistoryWrappedInventoryServices,
  createHistoryWrappedMappingServices,
  createHistoryWrappedProductServices,
  createHistoryWrappedShoppingServices,
  createHistoryWrappedUnitServices,
} from './action-history';
import { registerCorePrompts } from './prompts/core';
import { registerCoreResources } from './resources/core';
import { registerHistoryResources } from './resources/history';
import { registerInventoryResources } from './resources/inventory';
import { registerProductResources } from './resources/products';
import { registerShoppingResources } from './resources/shopping';
import { registerUnitResources } from './resources/units';
import { registerConflictTools } from './tools/conflicts';
import { registerConversionTools } from './tools/conversions';
import { registerDiagnosticTools } from './tools/diagnostics';
import { registerHistoryTools } from './tools/history';
import { registerInventoryTools } from './tools/inventory';
import { registerMappingTools } from './tools/mappings';
import { registerProductTools } from './tools/products';
import { registerShoppingTools } from './tools/shopping';
import { registerUnitTools } from './tools/units';

export function createGrocyMealieSyncMcpServer(
  overrides: GrocyMealieSyncMcpServiceOverrides = {},
): McpServer {
  const defaultProductServices = createHistoryWrappedProductServices({
    searchProducts,
    getProductOverview,
    checkProductDuplicates,
    updateGrocyStockSettings,
    createProductInGrocy,
    createProductInMealie,
    createProductInBoth,
    updateBasicProduct,
    deleteProduct,
    updateProductUnits,
  });

  const defaultShoppingServices = createHistoryWrappedShoppingServices({
    getShoppingListItemsResource,
    checkShoppingListProduct,
    addShoppingListItem,
    removeShoppingListItem,
    updateShoppingListItem,
    updateShoppingItemUnit,
    mergeShoppingListDuplicates,
  });

  const defaultInventoryServices = createHistoryWrappedInventoryServices({
    getInventoryStock,
    listLowStockProductsResource,
    addStock,
    consumeStock,
    setStock,
    markStockOpened,
  });

  const defaultMappingServices = createHistoryWrappedMappingServices({
    listProductMappingsResource,
    listUnitMappingsResource,
    listUnmappedProductsResource,
    listUnmappedUnitsResource,
    suggestProductMappings,
    suggestUnitMappings,
    upsertProductMapping,
    removeProductMapping,
    upsertUnitMapping,
    removeUnitMapping,
  });

  const defaultUnitServices = createHistoryWrappedUnitServices({
    getUnitCatalog,
    createGrocyUnit,
    createMealieUnit,
    compareUnits,
    normalizeMappedUnits,
    updateGrocyUnitMetadata,
    updateMealieUnitMetadata,
  });

  const services: GrocyMealieSyncMcpServices = {
    products: {
      ...defaultProductServices,
      ...overrides.products,
    },
    resources: {
      getStatusResource,
      listProductMappingsResource,
      listUnitMappingsResource,
      listUnmappedProductsResource,
      listUnmappedUnitsResource,
      listOpenMappingConflictsResource,
      getShoppingListItemsResource,
      listLowStockProductsResource,
      getUnitCatalogResource: getUnitCatalog,
      listRecentHistoryResource: () => listRecentHistoryResource(),
      getHistoryRunResource,
      ...overrides.resources,
    },
    shopping: {
      ...defaultShoppingServices,
      ...overrides.shopping,
    },
    inventory: {
      ...defaultInventoryServices,
      ...overrides.inventory,
    },
    mappings: {
      ...defaultMappingServices,
      ...overrides.mappings,
    },
    units: {
      ...defaultUnitServices,
      ...overrides.units,
    },
    conversions: {
      listConversions,
      createUnitConversion,
      deleteUnitConversion,
      ...overrides.conversions,
    },
    history: {
      listRecentHistoryResource,
      getHistoryRunResource,
      ...overrides.history,
    },
    conflicts: {
      listOpenMappingConflictsResource,
      ...overrides.conflicts,
    },
    diagnostics: {
      explainProductState,
      ...overrides.diagnostics,
    },
  };

  const server = new McpServer({
    name: 'grocy-mealie-sync',
    version: packageJson.version,
  });

  registerProductTools(server, services.products);
  registerShoppingTools(server, services.shopping);
  registerInventoryTools(server, services.inventory);
  registerMappingTools(server, services.mappings);
  registerUnitTools(server, services.units);
  registerConversionTools(server, services.conversions);
  registerHistoryTools(server, services.history);
  registerConflictTools(server, services.conflicts);
  registerDiagnosticTools(server, services.diagnostics);
  registerCorePrompts(server);
  registerCoreResources(server, services.resources);
  registerProductResources(server, services.products);
  registerShoppingResources(server, services.shopping);
  registerInventoryResources(server, services.inventory);
  registerUnitResources(server, services.units);
  registerHistoryResources(server, services.history);

  return server;
}
