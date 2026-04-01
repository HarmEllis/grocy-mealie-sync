import {
  buildManualHistoryEvent,
  createManualHistoryRecorder,
  formatManualActionError,
} from '@/lib/manual-action-history';
import type { HistoryEventInput, HistoryRunAction, HistoryRunStatus } from '@/lib/history-store';
import type {
  InventoryMcpServices,
  MappingMcpServices,
  ProductMcpServices,
  ShoppingMcpServices,
  UnitMcpServices,
} from './contracts';

type ManualMutation<P, R> = (params: P) => Promise<R>;
type ManualMutationNoArgs<R> = () => Promise<R>;

interface MutationHistorySuccess<R> {
  status?: HistoryRunStatus;
  logMessage?: string;
  message: string;
  summary?: unknown;
  events?: HistoryEventInput[];
}

interface MutationHistoryFailure {
  status?: Exclude<HistoryRunStatus, 'success'>;
  logMessage: string;
  message: string;
  summary?: unknown;
  events?: HistoryEventInput[];
}

interface MutationHistoryConfig<P, R> {
  action: HistoryRunAction;
  historyErrorPrefix: string;
  buildSuccess(result: R, params: P): MutationHistorySuccess<R>;
  buildFailure(error: unknown, params: P): MutationHistoryFailure;
}

function withMcpActionHistory<P, R>(
  mutation: ManualMutation<P, R>,
  config: MutationHistoryConfig<P, R>,
): ManualMutation<P, R> {
  return async (params: P) => {
    const history = createManualHistoryRecorder(config.action, config.historyErrorPrefix);

    try {
      const result = await mutation(params);
      const outcome = config.buildSuccess(result, params);
      await history.recordOutcome({
        status: outcome.status ?? 'success',
        logLevel: 'info',
        logMessage: outcome.logMessage,
        message: outcome.message,
        summary: outcome.summary,
        events: outcome.events,
      });

      return result;
    } catch (error) {
      const outcome = config.buildFailure(error, params);

      await history.recordFailure({
        status: outcome.status,
        logMessage: outcome.logMessage,
        error,
        message: outcome.message,
        summary: outcome.summary,
        events: outcome.events,
      });

      throw error;
    }
  };
}

function withMcpActionHistoryNoArgs<R>(
  mutation: ManualMutationNoArgs<R>,
  config: Omit<MutationHistoryConfig<void, R>, 'buildSuccess' | 'buildFailure'> & {
    buildSuccess(result: R): MutationHistorySuccess<R>;
    buildFailure(error: unknown): MutationHistoryFailure;
  },
): ManualMutationNoArgs<R> {
  return async () => {
    const history = createManualHistoryRecorder(config.action, config.historyErrorPrefix);

    try {
      const result = await mutation();
      const outcome = config.buildSuccess(result);
      await history.recordOutcome({
        status: outcome.status ?? 'success',
        logLevel: 'info',
        logMessage: outcome.logMessage,
        message: outcome.message,
        summary: outcome.summary,
        events: outcome.events,
      });

      return result;
    } catch (error) {
      const outcome = config.buildFailure(error);

      await history.recordFailure({
        status: outcome.status,
        logMessage: outcome.logMessage,
        error,
        message: outcome.message,
        summary: outcome.summary,
        events: outcome.events,
      });

      throw error;
    }
  };
}

function buildMcpFailureEvent(
  category: HistoryEventInput['category'],
  entityKind: HistoryEventInput['entityKind'],
  entityRef: string | null,
  message: string,
  error: unknown,
  details?: Record<string, unknown>,
): HistoryEventInput {
  return buildManualHistoryEvent({
    level: 'error',
    category,
    entityKind,
    entityRef,
    message,
    details: {
      ...(details ?? {}),
      error: formatManualActionError(error),
    },
  });
}

function toProductEntityRef(productRef: string, grocyProductId?: number | null) {
  return grocyProductId ? `grocy:${grocyProductId}` : productRef;
}

function toShoppingLabel(item: { foodName: string | null; display: string | null; id: string }) {
  return item.foodName ?? item.display ?? item.id;
}

export function createHistoryWrappedProductServices(services: ProductMcpServices): ProductMcpServices {
  return {
    ...services,
    updateGrocyStockSettings: withMcpActionHistory(services.updateGrocyStockSettings, {
      action: 'product_update_stock_settings',
      historyErrorPrefix: '[History] Failed to record MCP Grocy stock settings update:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Updated Grocy stock settings for "${result.name}".`,
        message: `Updated Grocy stock settings for "${result.name}".`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'product',
            entityKind: 'product',
            entityRef: `grocy:${result.grocyProductId}`,
            message: `Updated Grocy stock settings for "${result.name}".`,
            details: result,
          }),
        ],
      }),
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Update Grocy stock settings failed:',
        message: `Updating Grocy stock settings failed: ${formatManualActionError(error)}`,
        summary: {
          productRef: params.productRef,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'product',
            'product',
            params.productRef,
            'Updating Grocy stock settings failed.',
            error,
            { productRef: params.productRef },
          ),
        ],
      }),
    }),
    createProductInGrocy: withMcpActionHistory(services.createProductInGrocy, {
      action: 'mapping_product_create',
      historyErrorPrefix: '[History] Failed to record MCP Grocy product creation:',
      buildSuccess: (result, params) => {
        const created = result.created;
        const productName = result.grocyProductName ?? params.name;
        const message = created
          ? `Created Grocy product "${productName}".`
          : `Skipped Grocy product creation for "${params.name}" because an exact duplicate already exists.`;

        return {
          status: created ? 'success' : 'skipped',
          logMessage: created
            ? `[MCP] Created Grocy product "${productName}".`
            : `[MCP] Skipped Grocy product creation for "${params.name}" because an exact duplicate already exists.`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'product',
              entityKind: 'product',
              entityRef: result.grocyProductId ? `grocy:${result.grocyProductId}` : params.name,
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Create Grocy product failed:',
        message: `Grocy product creation failed: ${formatManualActionError(error)}`,
        summary: {
          name: params.name,
          grocyUnitId: params.grocyUnitId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'product',
            'product',
            params.name,
            'Grocy product creation failed.',
            error,
            { name: params.name, grocyUnitId: params.grocyUnitId },
          ),
        ],
      }),
    }),
    createProductInMealie: withMcpActionHistory(services.createProductInMealie, {
      action: 'mapping_product_create_mealie',
      historyErrorPrefix: '[History] Failed to record MCP Mealie product creation:',
      buildSuccess: (result, params) => {
        const created = result.created;
        const productName = result.mealieFoodName ?? params.name;
        const message = created
          ? `Created Mealie product "${productName}".`
          : `Skipped Mealie product creation for "${params.name}" because an exact duplicate already exists.`;

        return {
          status: created ? 'success' : 'skipped',
          logMessage: created
            ? `[MCP] Created Mealie product "${productName}".`
            : `[MCP] Skipped Mealie product creation for "${params.name}" because an exact duplicate already exists.`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'product',
              entityKind: 'product',
              entityRef: result.mealieFoodId ?? params.name,
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Create Mealie product failed:',
        message: `Mealie product creation failed: ${formatManualActionError(error)}`,
        summary: {
          name: params.name,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'product',
            'product',
            params.name,
            'Mealie product creation failed.',
            error,
            { name: params.name },
          ),
        ],
      }),
    }),
    createProductInBoth: withMcpActionHistory(services.createProductInBoth, {
      action: 'mapping_product_create_both',
      historyErrorPrefix: '[History] Failed to record MCP dual product creation:',
      buildSuccess: (result, params) => {
        const created = result.created;
        const productName = result.grocyProductName ?? result.mealieFoodName ?? params.name;
        const message = created
          ? `Created "${productName}" in Grocy and Mealie and stored the mapping.`
          : `Skipped creating "${params.name}" in Grocy and Mealie because exact duplicates already exist.`;

        return {
          status: created ? 'success' : 'skipped',
          logMessage: created
            ? `[MCP] Created "${productName}" in Grocy and Mealie and stored the mapping.`
            : `[MCP] Skipped creating "${params.name}" in Grocy and Mealie because exact duplicates already exist.`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'mapping',
              entityKind: 'product',
              entityRef: result.mealieFoodId ?? result.grocyProductId?.toString() ?? params.name,
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Create product in both systems failed:',
        message: `Creating the product in Grocy and Mealie failed: ${formatManualActionError(error)}`,
        summary: {
          name: params.name,
          grocyUnitId: params.grocyUnitId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'mapping',
            'product',
            params.name,
            'Creating the product in Grocy and Mealie failed.',
            error,
            { name: params.name, grocyUnitId: params.grocyUnitId },
          ),
        ],
      }),
    }),
    updateBasicProduct: withMcpActionHistory(services.updateBasicProduct, {
      action: 'product_update_basic',
      historyErrorPrefix: '[History] Failed to record MCP product metadata update:',
      buildSuccess: (result) => {
        const subject = result.updated.grocyName ?? result.updated.mealieName ?? result.productRef;
        const message = `Updated basic product metadata for "${subject}".`;

        return {
          logMessage: `[MCP] Updated basic product metadata for "${subject}".`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'product',
              entityKind: 'product',
              entityRef: toProductEntityRef(result.productRef, result.grocyProductId),
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Update basic product metadata failed:',
        message: `Updating basic product metadata failed: ${formatManualActionError(error)}`,
        summary: {
          productRef: params.productRef,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'product',
            'product',
            params.productRef,
            'Updating basic product metadata failed.',
            error,
            { productRef: params.productRef },
          ),
        ],
      }),
    }),
    deleteProduct: withMcpActionHistory(services.deleteProduct, {
      action: 'product_delete',
      historyErrorPrefix: '[History] Failed to record MCP product deletion:',
      buildSuccess: (result) => {
        const message = `Deleted product from ${result.system}.`;

        return {
          logMessage: `[MCP] Deleted product from ${result.system} (id: ${result.productId}).`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'product',
              entityKind: 'product',
              entityRef: result.system === 'grocy' ? `grocy:${result.productId}` : `mealie:${result.productId}`,
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Delete product failed:',
        message: `Deleting product failed: ${formatManualActionError(error)}`,
        summary: {
          productRef: params.productRef,
          system: params.system,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'product',
            'product',
            params.productRef,
            'Deleting product failed.',
            error,
            { productRef: params.productRef, system: params.system },
          ),
        ],
      }),
    }),
    updateProductUnits: withMcpActionHistory(services.updateProductUnits, {
      action: 'product_update_units',
      historyErrorPrefix: '[History] Failed to record MCP product units update:',
      buildSuccess: (result) => {
        const message = `Updated product units for grocy:${result.grocyProductId}.`;

        return {
          logMessage: `[MCP] Updated product units for grocy:${result.grocyProductId}.`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'product',
              entityKind: 'product',
              entityRef: `grocy:${result.grocyProductId}`,
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Update product units failed:',
        message: `Updating product units failed: ${formatManualActionError(error)}`,
        summary: {
          productRef: params.productRef,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'product',
            'product',
            params.productRef,
            'Updating product units failed.',
            error,
            { productRef: params.productRef },
          ),
        ],
      }),
    }),
  };
}

export function createHistoryWrappedInventoryServices(services: InventoryMcpServices): InventoryMcpServices {
  return {
    ...services,
    addStock: withMcpActionHistory(services.addStock, {
      action: 'inventory_add_stock',
      historyErrorPrefix: '[History] Failed to record MCP stock addition:',
      buildSuccess: (result) => {
        const openedSuffix = result.openedAmount !== undefined
          ? ` (${result.openedAmount} opened)`
          : '';
        const messageSuffix = result.openedAmount !== undefined
          ? `, with ${result.openedAmount} marked opened`
          : '';

        return {
          logMessage: `[MCP] Added stock for "${result.name}": ${result.amount}${openedSuffix}.`,
          message: `Added ${result.amount} stock to Grocy product "${result.name}"${messageSuffix}.`,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'inventory',
              entityKind: 'product',
              entityRef: `grocy:${result.grocyProductId}`,
              message: `Added ${result.amount} stock to Grocy product "${result.name}"${messageSuffix}.`,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Add stock failed:',
        message: `Adding stock failed: ${formatManualActionError(error)}`,
        summary: {
          productRef: params.productRef,
          amount: params.amount,
          ...(params.openedAmount !== undefined ? { openedAmount: params.openedAmount } : {}),
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'inventory',
            'product',
            params.productRef,
            'Adding stock failed.',
            error,
            {
              productRef: params.productRef,
              amount: params.amount,
              ...(params.openedAmount !== undefined ? { openedAmount: params.openedAmount } : {}),
            },
          ),
        ],
      }),
    }),
    consumeStock: withMcpActionHistory(services.consumeStock, {
      action: 'inventory_consume_stock',
      historyErrorPrefix: '[History] Failed to record MCP stock consumption:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Consumed stock for "${result.name}": ${result.amount}.`,
        message: `Consumed ${result.amount} stock from Grocy product "${result.name}".`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'inventory',
            entityKind: 'product',
            entityRef: `grocy:${result.grocyProductId}`,
            message: `Consumed ${result.amount} stock from Grocy product "${result.name}".`,
            details: result,
          }),
        ],
      }),
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Consume stock failed:',
        message: `Consuming stock failed: ${formatManualActionError(error)}`,
        summary: {
          productRef: params.productRef,
          amount: params.amount,
          spoiled: params.spoiled ?? false,
          exactAmount: params.exactAmount ?? false,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'inventory',
            'product',
            params.productRef,
            'Consuming stock failed.',
            error,
            {
              productRef: params.productRef,
              amount: params.amount,
              spoiled: params.spoiled ?? false,
              exactAmount: params.exactAmount ?? false,
            },
          ),
        ],
      }),
    }),
    setStock: withMcpActionHistory(services.setStock, {
      action: 'inventory_set_stock',
      historyErrorPrefix: '[History] Failed to record MCP stock correction:',
      buildSuccess: (result) => {
        const openedSuffix = result.openedAmount !== undefined
          ? ` (${result.openedAmount} opened)`
          : '';
        const messageSuffix = result.openedAmount !== undefined
          ? `, with ${result.openedAmount} opened`
          : '';

        return {
          logMessage: `[MCP] Set stock for "${result.name}" to ${result.amount}${openedSuffix}.`,
          message: `Set Grocy product "${result.name}" stock to ${result.amount}${messageSuffix}.`,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'inventory',
              entityKind: 'product',
              entityRef: `grocy:${result.grocyProductId}`,
              message: `Set Grocy product "${result.name}" stock to ${result.amount}${messageSuffix}.`,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Set stock failed:',
        message: `Setting stock failed: ${formatManualActionError(error)}`,
        summary: {
          productRef: params.productRef,
          amount: params.amount,
          ...(params.openedAmount !== undefined ? { openedAmount: params.openedAmount } : {}),
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'inventory',
            'product',
            params.productRef,
            'Setting stock failed.',
            error,
            {
              productRef: params.productRef,
              amount: params.amount,
              ...(params.openedAmount !== undefined ? { openedAmount: params.openedAmount } : {}),
            },
          ),
        ],
      }),
    }),
    markStockOpened: withMcpActionHistory(services.markStockOpened, {
      action: 'inventory_mark_opened',
      historyErrorPrefix: '[History] Failed to record MCP opened stock update:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Marked stock opened for "${result.name}": ${result.amount}.`,
        message: `Marked ${result.amount} stock as opened for Grocy product "${result.name}".`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'inventory',
            entityKind: 'product',
            entityRef: `grocy:${result.grocyProductId}`,
            message: `Marked ${result.amount} stock as opened for Grocy product "${result.name}".`,
            details: result,
          }),
        ],
      }),
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Mark stock opened failed:',
        message: `Marking stock as opened failed: ${formatManualActionError(error)}`,
        summary: {
          productRef: params.productRef,
          amount: params.amount ?? 1,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'inventory',
            'product',
            params.productRef,
            'Marking stock as opened failed.',
            error,
            { productRef: params.productRef, amount: params.amount ?? 1 },
          ),
        ],
      }),
    }),
  };
}

export function createHistoryWrappedShoppingServices(services: ShoppingMcpServices): ShoppingMcpServices {
  function buildShoppingAddSuccess(result: Awaited<ReturnType<ShoppingMcpServices['addShoppingListItem']>>) {
    const label = toShoppingLabel(result.item);
    const message = result.action === 'updated'
      ? `Merged into an existing shopping list item for "${label}".`
      : `Added a shopping list item for "${label}".`;

    return {
      logMessage: result.action === 'updated'
        ? `[MCP] Merged shopping list item for "${label}".`
        : `[MCP] Added shopping list item for "${label}".`,
      message,
      summary: result,
      events: [
        buildManualHistoryEvent({
          level: 'info',
          category: 'shopping',
          entityKind: 'shopping_item',
          entityRef: result.item.id,
          message,
          details: result,
        }),
      ],
    };
  }

  return {
    ...services,
    addShoppingListItem: withMcpActionHistory(services.addShoppingListItem, {
      action: 'shopping_add_item',
      historyErrorPrefix: '[History] Failed to record MCP shopping item add:',
      buildSuccess: (result) => buildShoppingAddSuccess(result),
      buildFailure: (error, params) => {
        const ref = params.foodId ?? params.query ?? 'unknown';
        return {
          logMessage: '[MCP] Add shopping item failed:',
          message: `Adding a shopping list item failed: ${formatManualActionError(error)}`,
          summary: {
            foodId: params.foodId ?? null,
            query: params.query ?? null,
            quantity: params.quantity ?? 1,
            note: params.note ?? null,
            error: formatManualActionError(error),
          },
          events: [
            buildMcpFailureEvent(
              'shopping',
              'shopping_item',
              ref,
              'Adding a shopping list item failed.',
              error,
              {
                foodId: params.foodId ?? null,
                query: params.query ?? null,
                quantity: params.quantity ?? 1,
                note: params.note ?? null,
              },
            ),
          ],
        };
      },
    }),
    updateShoppingListItem: withMcpActionHistory(services.updateShoppingListItem, {
      action: 'shopping_update_item',
      historyErrorPrefix: '[History] Failed to record MCP shopping item update:',
      buildSuccess: (result, params) => {
        const label = toShoppingLabel(result.item);
        const message = params.checked !== undefined
          ? `Marked shopping list item "${label}" as ${params.checked ? 'checked' : 'unchecked'}.`
          : `Updated quantity for shopping list item "${label}" to ${result.item.quantity}.`;

        return {
          logMessage: `[MCP] ${message}`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'shopping',
              entityKind: 'shopping_item',
              entityRef: result.item.id,
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Update shopping item failed:',
        message: `Updating a shopping list item failed: ${formatManualActionError(error)}`,
        summary: {
          itemId: params.itemId,
          checked: params.checked,
          quantity: params.quantity,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'shopping',
            'shopping_item',
            params.itemId,
            'Updating a shopping list item failed.',
            error,
            {
              itemId: params.itemId,
              checked: params.checked,
              quantity: params.quantity,
            },
          ),
        ],
      }),
    }),
    removeShoppingListItem: withMcpActionHistory(services.removeShoppingListItem, {
      action: 'shopping_remove_item',
      historyErrorPrefix: '[History] Failed to record MCP shopping item removal:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Removed shopping list item ${result.itemId}.`,
        message: `Removed shopping list item ${result.itemId}.`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'shopping',
            entityKind: 'shopping_item',
            entityRef: result.itemId,
            message: `Removed shopping list item ${result.itemId}.`,
            details: result,
          }),
        ],
      }),
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Remove shopping item failed:',
        message: `Removing a shopping list item failed: ${formatManualActionError(error)}`,
        summary: {
          itemId: params.itemId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'shopping',
            'shopping_item',
            params.itemId,
            'Removing a shopping list item failed.',
            error,
            { itemId: params.itemId },
          ),
        ],
      }),
    }),
    mergeShoppingListDuplicates: withMcpActionHistory(services.mergeShoppingListDuplicates, {
      action: 'shopping_merge_duplicates',
      historyErrorPrefix: '[History] Failed to record MCP shopping duplicate merge:',
      buildSuccess: (result, params) => {
        const message = result.merged
          ? `Merged duplicate shopping list items for food ${params.foodId}.`
          : `No duplicate shopping list items needed merging for food ${params.foodId}.`;

        return {
          status: result.merged ? 'success' : 'skipped',
          logMessage: result.merged
            ? `[MCP] Merged duplicate shopping list items for food ${params.foodId}.`
            : `[MCP] No duplicate shopping list items needed merging for food ${params.foodId}.`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'shopping',
              entityKind: 'shopping_item',
              entityRef: params.foodId,
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Merge shopping duplicates failed:',
        message: `Merging shopping list duplicates failed: ${formatManualActionError(error)}`,
        summary: {
          foodId: params.foodId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'shopping',
            'shopping_item',
            params.foodId,
            'Merging shopping list duplicates failed.',
            error,
            { foodId: params.foodId },
          ),
        ],
      }),
    }),
    updateShoppingItemUnit: withMcpActionHistory(services.updateShoppingItemUnit, {
      action: 'shopping_update_unit',
      historyErrorPrefix: '[History] Failed to record MCP shopping item unit update:',
      buildSuccess: (result) => {
        const label = toShoppingLabel(result.item);
        const message = `Updated unit for shopping list item "${label}".`;

        return {
          logMessage: `[MCP] Updated unit for shopping list item "${label}".`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'shopping',
              entityKind: 'shopping_item',
              entityRef: result.item.id,
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Update shopping item unit failed:',
        message: `Updating shopping item unit failed: ${formatManualActionError(error)}`,
        summary: {
          itemId: params.itemId,
          unitId: params.unitId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'shopping',
            'shopping_item',
            params.itemId,
            'Updating shopping item unit failed.',
            error,
            { itemId: params.itemId, unitId: params.unitId },
          ),
        ],
      }),
    }),
  };
}

export function createHistoryWrappedMappingServices(services: MappingMcpServices): MappingMcpServices {
  return {
    ...services,
    upsertProductMapping: withMcpActionHistory(services.upsertProductMapping, {
      action: 'mapping_product_sync',
      historyErrorPrefix: '[History] Failed to record MCP product mapping upsert:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Upserted product mapping ${result.mappingId}.`,
        message: `Mapped Mealie product "${result.mealieFoodName}" to Grocy product "${result.grocyProductName}".`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'mapping',
            entityKind: 'product',
            entityRef: result.mappingId,
            message: `Mapped Mealie product "${result.mealieFoodName}" to Grocy product "${result.grocyProductName}".`,
            details: result,
          }),
        ],
      }),
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Upsert product mapping failed:',
        message: `Product mapping upsert failed: ${formatManualActionError(error)}`,
        summary: {
          mealieFoodId: params.mealieFoodId,
          grocyProductId: params.grocyProductId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'mapping',
            'product',
            params.mappingId ?? params.mealieFoodId,
            'Product mapping upsert failed.',
            error,
            {
              mealieFoodId: params.mealieFoodId,
              grocyProductId: params.grocyProductId,
              grocyUnitId: params.grocyUnitId ?? null,
            },
          ),
        ],
      }),
    }),
    removeProductMapping: withMcpActionHistory(services.removeProductMapping, {
      action: 'mapping_product_unmap',
      historyErrorPrefix: '[History] Failed to record MCP product mapping removal:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Removed product mapping ${result.mappingId}.`,
        message: `Removed product mapping ${result.mappingId}.`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'mapping',
            entityKind: 'product',
            entityRef: result.mappingId,
            message: `Removed product mapping ${result.mappingId}.`,
            details: result,
          }),
        ],
      }),
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Remove product mapping failed:',
        message: `Product mapping removal failed: ${formatManualActionError(error)}`,
        summary: {
          mappingId: params.mappingId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'mapping',
            'product',
            params.mappingId,
            'Product mapping removal failed.',
            error,
            { mappingId: params.mappingId },
          ),
        ],
      }),
    }),
    upsertUnitMapping: withMcpActionHistory(services.upsertUnitMapping, {
      action: 'mapping_unit_sync',
      historyErrorPrefix: '[History] Failed to record MCP unit mapping upsert:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Upserted unit mapping ${result.mappingId}.`,
        message: `Mapped Mealie unit "${result.mealieUnitName}" to Grocy unit "${result.grocyUnitName}".`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'mapping',
            entityKind: 'unit',
            entityRef: result.mappingId,
            message: `Mapped Mealie unit "${result.mealieUnitName}" to Grocy unit "${result.grocyUnitName}".`,
            details: result,
          }),
        ],
      }),
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Upsert unit mapping failed:',
        message: `Unit mapping upsert failed: ${formatManualActionError(error)}`,
        summary: {
          mealieUnitId: params.mealieUnitId,
          grocyUnitId: params.grocyUnitId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'mapping',
            'unit',
            params.mappingId ?? params.mealieUnitId,
            'Unit mapping upsert failed.',
            error,
            { mealieUnitId: params.mealieUnitId, grocyUnitId: params.grocyUnitId },
          ),
        ],
      }),
    }),
    removeUnitMapping: withMcpActionHistory(services.removeUnitMapping, {
      action: 'mapping_unit_unmap',
      historyErrorPrefix: '[History] Failed to record MCP unit mapping removal:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Removed unit mapping ${result.mappingId}.`,
        message: `Removed unit mapping ${result.mappingId}.`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'mapping',
            entityKind: 'unit',
            entityRef: result.mappingId,
            message: `Removed unit mapping ${result.mappingId}.`,
            details: result,
          }),
        ],
      }),
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Remove unit mapping failed:',
        message: `Unit mapping removal failed: ${formatManualActionError(error)}`,
        summary: {
          mappingId: params.mappingId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'mapping',
            'unit',
            params.mappingId,
            'Unit mapping removal failed.',
            error,
            { mappingId: params.mappingId },
          ),
        ],
      }),
    }),
  };
}

export function createHistoryWrappedUnitServices(services: UnitMcpServices): UnitMcpServices {
  return {
    ...services,
    createGrocyUnit: withMcpActionHistory(services.createGrocyUnit, {
      action: 'mapping_unit_create',
      historyErrorPrefix: '[History] Failed to record MCP Grocy unit creation:',
      buildSuccess: (result, params) => {
        const unitName = result.grocyUnitName ?? params.name;
        const message = result.created
          ? `Created Grocy unit "${unitName}".`
          : `Skipped Grocy unit creation for "${params.name}" because an exact duplicate already exists.`;

        return {
          status: result.created ? 'success' : 'skipped',
          logMessage: result.created
            ? `[MCP] Created Grocy unit "${unitName}".`
            : `[MCP] Skipped Grocy unit creation for "${params.name}" because an exact duplicate already exists.`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'mapping',
              entityKind: 'unit',
              entityRef: result.grocyUnitId ? `grocy:${result.grocyUnitId}` : params.name,
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Create Grocy unit failed:',
        message: `Grocy unit creation failed: ${formatManualActionError(error)}`,
        summary: {
          name: params.name,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'mapping',
            'unit',
            params.name,
            'Grocy unit creation failed.',
            error,
            { name: params.name },
          ),
        ],
      }),
    }),
    createMealieUnit: withMcpActionHistory(services.createMealieUnit, {
      action: 'mapping_unit_create_mealie',
      historyErrorPrefix: '[History] Failed to record MCP Mealie unit creation:',
      buildSuccess: (result, params) => {
        const unitName = result.mealieUnitName ?? params.name;
        const message = result.created
          ? `Created Mealie unit "${unitName}".`
          : `Skipped Mealie unit creation for "${params.name}" because an exact duplicate already exists.`;

        return {
          status: result.created ? 'success' : 'skipped',
          logMessage: result.created
            ? `[MCP] Created Mealie unit "${unitName}".`
            : `[MCP] Skipped Mealie unit creation for "${params.name}" because an exact duplicate already exists.`,
          message,
          summary: result,
          events: [
            buildManualHistoryEvent({
              level: 'info',
              category: 'mapping',
              entityKind: 'unit',
              entityRef: result.mealieUnitId ?? params.name,
              message,
              details: result,
            }),
          ],
        };
      },
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Create Mealie unit failed:',
        message: `Mealie unit creation failed: ${formatManualActionError(error)}`,
        summary: {
          name: params.name,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'mapping',
            'unit',
            params.name,
            'Mealie unit creation failed.',
            error,
            { name: params.name },
          ),
        ],
      }),
    }),
    normalizeMappedUnits: withMcpActionHistoryNoArgs(services.normalizeMappedUnits, {
      action: 'mapping_unit_normalize',
      historyErrorPrefix: '[History] Failed to record MCP unit normalization:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Units normalized: Mealie ${result.normalizedMealie}, Grocy ${result.normalizedGrocy}.`,
        message: `Normalized ${result.normalizedMealie} Mealie and ${result.normalizedGrocy} Grocy unit name(s).`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'mapping',
            entityKind: 'unit',
            entityRef: 'units',
            message: 'Normalized mapped unit metadata.',
            details: result,
          }),
        ],
      }),
      buildFailure: (error) => ({
        logMessage: '[MCP] Normalize units failed:',
        message: `Unit normalization failed: ${formatManualActionError(error)}`,
        summary: { error: formatManualActionError(error) },
        events: [
          buildMcpFailureEvent(
            'mapping',
            'unit',
            'units',
            'Unit normalization failed.',
            error,
          ),
        ],
      }),
    }),
    updateGrocyUnitMetadata: withMcpActionHistory(services.updateGrocyUnitMetadata, {
      action: 'unit_update_grocy',
      historyErrorPrefix: '[History] Failed to record MCP Grocy unit update:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Updated Grocy unit ${result.grocyUnitId}.`,
        message: `Updated Grocy unit ${result.grocyUnitId}.`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'mapping',
            entityKind: 'unit',
            entityRef: `grocy:${result.grocyUnitId}`,
            message: `Updated Grocy unit ${result.grocyUnitId}.`,
            details: result,
          }),
        ],
      }),
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Update Grocy unit failed:',
        message: `Updating the Grocy unit failed: ${formatManualActionError(error)}`,
        summary: {
          grocyUnitId: params.grocyUnitId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'mapping',
            'unit',
            `grocy:${params.grocyUnitId}`,
            'Updating the Grocy unit failed.',
            error,
            { grocyUnitId: params.grocyUnitId },
          ),
        ],
      }),
    }),
    updateMealieUnitMetadata: withMcpActionHistory(services.updateMealieUnitMetadata, {
      action: 'unit_update_mealie',
      historyErrorPrefix: '[History] Failed to record MCP Mealie unit update:',
      buildSuccess: (result) => ({
        logMessage: `[MCP] Updated Mealie unit ${result.mealieUnitId}.`,
        message: `Updated Mealie unit ${result.mealieUnitId}.`,
        summary: result,
        events: [
          buildManualHistoryEvent({
            level: 'info',
            category: 'mapping',
            entityKind: 'unit',
            entityRef: result.mealieUnitId,
            message: `Updated Mealie unit ${result.mealieUnitId}.`,
            details: result,
          }),
        ],
      }),
      buildFailure: (error, params) => ({
        logMessage: '[MCP] Update Mealie unit failed:',
        message: `Updating the Mealie unit failed: ${formatManualActionError(error)}`,
        summary: {
          mealieUnitId: params.mealieUnitId,
          error: formatManualActionError(error),
        },
        events: [
          buildMcpFailureEvent(
            'mapping',
            'unit',
            params.mealieUnitId,
            'Updating the Mealie unit failed.',
            error,
            { mealieUnitId: params.mealieUnitId },
          ),
        ],
      }),
    }),
  };
}
