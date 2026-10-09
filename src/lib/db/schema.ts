import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const productMappings = sqliteTable('product_mappings', {
  id: text('id').primaryKey(),
  mealieFoodId: text('mealie_food_id').notNull(),
  mealieFoodName: text('mealie_food_name').notNull(),
  grocyProductId: integer('grocy_product_id').notNull(),
  grocyProductName: text('grocy_product_name').notNull(),
  unitMappingId: text('unit_mapping_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  uniqueIndex('idx_product_mappings_mealie_food_id').on(table.mealieFoodId),
  uniqueIndex('idx_product_mappings_grocy_product_id').on(table.grocyProductId),
]);

export const unitMappings = sqliteTable('unit_mappings', {
  id: text('id').primaryKey(),
  mealieUnitId: text('mealie_unit_id').notNull(),
  mealieUnitName: text('mealie_unit_name').notNull(),
  mealieUnitAbbreviation: text('mealie_unit_abbreviation').notNull(),
  grocyUnitId: integer('grocy_unit_id').notNull(),
  grocyUnitName: text('grocy_unit_name').notNull(),
  conversionFactor: real('conversion_factor').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  uniqueIndex('idx_unit_mappings_mealie_unit_id').on(table.mealieUnitId),
  uniqueIndex('idx_unit_mappings_grocy_unit_id').on(table.grocyUnitId),
]);

export const syncState = sqliteTable('sync_state', {
  id: text('id').primaryKey(),
  stateData: text('state_data').notNull(), // JSON blob for lastGrocyPoll, lastMealiePoll, etc.
});

export const runtimeLocks = sqliteTable('runtime_locks', {
  name: text('name').primaryKey(),
  ownerId: text('owner_id').notNull(),
  expiresAt: integer('expires_at', { mode: 'number' }).notNull(),
});

export const mappingConflicts = sqliteTable('mapping_conflicts', {
  id: text('id').primaryKey(),
  conflictKey: text('conflict_key').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  severity: text('severity').notNull(),
  mappingKind: text('mapping_kind').notNull(),
  mappingId: text('mapping_id').notNull(),
  sourceTab: text('source_tab').notNull(),
  mealieId: text('mealie_id'),
  mealieName: text('mealie_name'),
  grocyId: integer('grocy_id'),
  grocyName: text('grocy_name'),
  summary: text('summary').notNull(),
  occurrences: integer('occurrences').notNull(),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
}, (table) => [
  uniqueIndex('idx_mapping_conflicts_conflict_key').on(table.conflictKey),
]);

export const historyRuns = sqliteTable('history_runs', {
  id: text('id').primaryKey(),
  trigger: text('trigger').notNull(),
  action: text('action').notNull(),
  status: text('status').notNull(),
  message: text('message'),
  summaryJson: text('summary_json'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp' }).notNull(),
});

export const historyEvents = sqliteTable('history_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  level: text('level').notNull(),
  kind: text('kind').notNull().default('diagnostic'),
  productName: text('product_name'),
  source: text('source'),
  target: text('target'),
  reason: text('reason'),
  category: text('category').notNull(),
  entityKind: text('entity_kind'),
  entityRef: text('entity_ref'),
  message: text('message').notNull(),
  detailsJson: text('details_json'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('idx_history_events_run_id_created_at').on(table.runId, table.createdAt, table.id),
  index('idx_history_events_kind_created_at').on(table.kind, table.createdAt, table.id),
]);

// ---------------------------------------------------------------------------
// Shop plugins
// ---------------------------------------------------------------------------

/** One external shop plugin container, authenticated by its own token. */
export const pluginInstallations = sqliteTable('plugin_installations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** sha256 of the token secret; the token itself is shown once and never stored. */
  tokenHash: text('token_hash').notNull(),
  tokenHint: text('token_hint').notNull(),
  providerId: text('provider_id'),
  providerLabel: text('provider_label'),
  accountKey: text('account_key'),
  accountLabel: text('account_label'),
  authState: text('auth_state'),
  manifestJson: text('manifest_json'),
  settingsJson: text('settings_json').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  rotatedAt: integer('rotated_at', { mode: 'timestamp_ms' }),
  revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
}, (table) => [
  uniqueIndex('idx_plugin_installations_token_hash').on(table.tokenHash),
]);

/** Small durable key/value facts that must not live in the sync_state JSON blob. */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ---------------------------------------------------------------------------
// Durable effect ledger and demand observation. Never pruned by history retention.
// ---------------------------------------------------------------------------

/** One observed "checked" transition of a Mealie shopping item, reused across retries. */
export const checkLifecycles = sqliteTable('check_lifecycles', {
  id: text('id').primaryKey(),
  mealieItemId: text('mealie_item_id').notNull(),
  demandRevisionId: text('demand_revision_id'),
  mealieFoodId: text('mealie_food_id'),
  grocyProductId: integer('grocy_product_id'),
  quantity: real('quantity'),
  status: text('status').notNull(),
  checkedObservedAt: integer('checked_observed_at', { mode: 'timestamp_ms' }).notNull(),
  closedReason: text('closed_reason'),
  closedAt: integer('closed_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('idx_check_lifecycles_item').on(table.mealieItemId, table.status),
]);

/** Write-ahead ledger of every external write made by the shop features and manual checks. */
export const shopEffects = sqliteTable('shop_effects', {
  id: text('id').primaryKey(),
  effectKey: text('effect_key').notNull(),
  kind: text('kind').notNull(),
  sourceKind: text('source_kind').notNull(),
  sourceRef: text('source_ref').notNull(),
  payloadJson: text('payload_json').notNull(),
  status: text('status').notNull(),
  attempts: integer('attempts').notNull().default(0),
  evidenceJson: text('evidence_json'),
  externalRef: text('external_ref'),
  error: text('error'),
  dependsOn: text('depends_on'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }),
}, (table) => [
  uniqueIndex('idx_shop_effects_effect_key').on(table.effectKey),
  index('idx_shop_effects_status').on(table.status),
  index('idx_shop_effects_source').on(table.sourceKind, table.sourceRef),
]);

/** A Mealie shopping list row as observed over time. Removal means cancelled, never purchased. */
export const demands = sqliteTable('demands', {
  mealieItemId: text('mealie_item_id').primaryKey(),
  shoppingListId: text('shopping_list_id').notNull(),
  status: text('status').notNull(),
  latestRevisionId: text('latest_revision_id'),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' }).notNull(),
  checkedAt: integer('checked_at', { mode: 'timestamp_ms' }),
  removedAt: integer('removed_at', { mode: 'timestamp_ms' }),
}, (table) => [
  index('idx_demands_status').on(table.status),
]);

export const demandRevisions = sqliteTable('demand_revisions', {
  id: text('id').primaryKey(),
  mealieItemId: text('mealie_item_id').notNull(),
  revision: integer('revision').notNull(),
  foodId: text('food_id'),
  unitId: text('unit_id'),
  quantity: real('quantity').notNull(),
  note: text('note'),
  subItemsJson: text('sub_items_json'),
  checked: integer('checked', { mode: 'boolean' }).notNull(),
  fingerprint: text('fingerprint').notNull(),
  observedAt: integer('observed_at', { mode: 'timestamp_ms' }).notNull(),
  supersededAt: integer('superseded_at', { mode: 'timestamp_ms' }),
}, (table) => [
  uniqueIndex('idx_demand_revisions_item_revision').on(table.mealieItemId, table.revision),
]);

// ---------------------------------------------------------------------------
// Retailer catalogue and central mappings (provider level, shared by installations)
// ---------------------------------------------------------------------------

/** Durable automatic catalogue searches for ingredients on the active Mealie list. */
export const shopCatalogSearches = sqliteTable('shop_catalog_searches', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  targetName: text('target_name').notNull(),
  query: text('query').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  resultCount: integer('result_count').notNull().default(0),
  lastError: text('last_error'),
  nextAttemptAt: integer('next_attempt_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [index('idx_shop_catalog_searches_provider').on(table.providerId)]);

export const retailerProducts = sqliteTable('retailer_products', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  gtinsJson: text('gtins_json'),
  packageAmount: real('package_amount'),
  packageUnit: text('package_unit'),
  measure: text('measure').notNull(),
  /**
   * available | temporarily_unavailable | discontinued | unknown. Only an
   * explicit retailer statement changes it; a product missing from search
   * results keeps its last known value.
   */
  availability: text('availability').notNull().default('unknown'),
  /** When the retailer last reported a known availability; null while never checked. */
  availabilityCheckedAt: integer('availability_checked_at', { mode: 'timestamp_ms' }),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('idx_retailer_products_provider_external').on(table.providerId, table.externalId),
]);

/**
 * Links a retailer product to a Grocy product or a Mealie-only food. Package
 * amounts are expressed in the target base unit (Grocy stock unit, or the
 * Mealie unit) per one receipt quantity unit. Automatic processing requires
 * `confirmed`.
 */
export const retailerMappings = sqliteTable('retailer_mappings', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  retailerProductId: text('retailer_product_id').notNull(),
  retailerProductName: text('retailer_product_name').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  targetName: text('target_name').notNull(),
  role: text('role').notNull(),
  packageBaseAmount: real('package_base_amount'),
  packageBaseUnitId: text('package_base_unit_id'),
  packageBaseUnitName: text('package_base_unit_name'),
  packageSource: text('package_source'),
  confirmed: integer('confirmed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('idx_retailer_mappings_provider_product').on(table.providerId, table.retailerProductId),
  index('idx_retailer_mappings_target').on(table.targetKind, table.targetId),
]);

/** Suggested links; a decided pair is never suggested again. */
export const retailerSuggestions = sqliteTable('retailer_suggestions', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  retailerProductId: text('retailer_product_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  targetName: text('target_name').notNull(),
  score: real('score').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  decidedAt: integer('decided_at', { mode: 'timestamp_ms' }),
}, (table) => [
  uniqueIndex('idx_retailer_suggestions_pair').on(table.providerId, table.retailerProductId, table.targetKind, table.targetId),
]);

// ---------------------------------------------------------------------------
// Shared shopping list projection
// ---------------------------------------------------------------------------

/** Versioned export of demand for one retailer product to one installation's list. Superseded versions are kept. */
export const shopExports = sqliteTable('shop_exports', {
  id: text('id').primaryKey(),
  installationId: text('installation_id').notNull(),
  providerId: text('provider_id').notNull(),
  retailerProductId: text('retailer_product_id').notNull(),
  packages: integer('packages').notNull(),
  baseAmount: real('base_amount').notNull(),
  fingerprint: text('fingerprint').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  supersededAt: integer('superseded_at', { mode: 'timestamp_ms' }),
  /** First moment this demand was visible on the list as a free-text note instead of the product. */
  noteExposedAt: integer('note_exposed_at', { mode: 'timestamp_ms' }),
}, (table) => [
  index('idx_shop_exports_installation_product').on(table.installationId, table.retailerProductId),
]);

export const shopExportAllocations = sqliteTable('shop_export_allocations', {
  id: text('id').primaryKey(),
  exportId: text('export_id').notNull(),
  demandRevisionId: text('demand_revision_id').notNull(),
  mealieItemId: text('mealie_item_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  baseAmount: real('base_amount').notNull(),
  /** Factor from the Mealie row quantity to the base amount, used to reduce the row later. */
  rowFactor: real('row_factor').notNull(),
}, (table) => [
  index('idx_shop_export_allocations_export').on(table.exportId),
  index('idx_shop_export_allocations_revision').on(table.demandRevisionId),
]);

/**
 * Ownership of a line on the retailer's shared list. Only lines with a record
 * are ever touched. `kind = note` records own the free-text note that stands in
 * for a discontinued retailer product; `retailerProductId` then names that
 * product, whose export the note represents.
 */
export const shopListLines = sqliteTable('shop_list_lines', {
  id: text('id').primaryKey(),
  installationId: text('installation_id').notNull(),
  retailerProductId: text('retailer_product_id').notNull(),
  kind: text('kind').notNull().default('product'),
  /** Exact text of an owned note. */
  noteText: text('note_text'),
  lineId: text('line_id'),
  managedQty: integer('managed_qty').notNull(),
  baselineUserQty: integer('baseline_user_qty').notNull(),
  lastWrittenQty: integer('last_written_qty').notNull(),
  pausedReason: text('paused_reason'),
  pausedObservedQty: integer('paused_observed_qty'),
  /** Export version active when the user released the line; a newer export re-adopts it. */
  releasedExportId: text('released_export_id'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('idx_shop_list_lines_installation_product_kind').on(table.installationId, table.retailerProductId, table.kind),
]);

// ---------------------------------------------------------------------------
// Receipts and reconciliation
// ---------------------------------------------------------------------------

export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey(),
  installationId: text('installation_id').notNull(),
  providerId: text('provider_id').notNull(),
  accountKey: text('account_key').notNull(),
  externalReceiptId: text('external_receipt_id').notNull(),
  purchasedAt: integer('purchased_at', { mode: 'timestamp_ms' }).notNull(),
  fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' }).notNull(),
  contentHash: text('content_hash'),
  status: text('status').notNull(),
  lineCount: integer('line_count').notNull(),
  storeLabel: text('store_label'),
  totalCents: integer('total_cents'),
  processedAt: integer('processed_at', { mode: 'timestamp_ms' }),
}, (table) => [
  // Deduplicated per retailer account, so two installations of the same account never book a receipt twice.
  uniqueIndex('idx_receipts_provider_account_external').on(table.providerId, table.accountKey, table.externalReceiptId),
  index('idx_receipts_status').on(table.status),
]);

export const receiptLines = sqliteTable('receipt_lines', {
  id: text('id').primaryKey(),
  receiptId: text('receipt_id').notNull(),
  lineNo: integer('line_no').notNull(),
  kind: text('kind').notNull(),
  retailerProductId: text('retailer_product_id'),
  gtin: text('gtin'),
  description: text('description').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  unitPriceCents: integer('unit_price_cents'),
  amountCents: integer('amount_cents'),
  status: text('status').notNull(),
  reviewReason: text('review_reason'),
}, (table) => [
  uniqueIndex('idx_receipt_lines_receipt_line').on(table.receiptId, table.lineNo),
]);

/** How a receipt line was attributed: credit for a manual check, demand allocation, extra or substitution. */
export const reconciliationLinks = sqliteTable('reconciliation_links', {
  id: text('id').primaryKey(),
  receiptLineId: text('receipt_line_id').notNull(),
  kind: text('kind').notNull(),
  lifecycleId: text('lifecycle_id'),
  demandRevisionId: text('demand_revision_id'),
  mealieItemId: text('mealie_item_id'),
  exportId: text('export_id'),
  targetKind: text('target_kind'),
  targetId: text('target_id'),
  baseAmount: real('base_amount').notNull(),
  effectId: text('effect_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('idx_reconciliation_links_line').on(table.receiptLineId),
  index('idx_reconciliation_links_lifecycle').on(table.lifecycleId),
]);

export const discrepancies = sqliteTable('discrepancies', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
  receiptLineId: text('receipt_line_id'),
  lifecycleId: text('lifecycle_id'),
  evidenceJson: text('evidence_json').notNull(),
  resolution: text('resolution'),
  resolutionEffectId: text('resolution_effect_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
}, (table) => [
  uniqueIndex('idx_discrepancies_identity').on(table.kind, table.receiptLineId, table.lifecycleId),
]);

/** Durable receipt pull position per installation and retailer account. */
export const receiptCursors = sqliteTable('receipt_cursors', {
  id: text('id').primaryKey(),
  installationId: text('installation_id').notNull(),
  accountKey: text('account_key').notNull(),
  sinceAt: integer('since_at', { mode: 'timestamp_ms' }),
  lastPullAt: integer('last_pull_at', { mode: 'timestamp_ms' }),
  /** Continuation of an unfinished paged pull; the high-water mark only advances once it is drained. */
  pageCursor: text('page_cursor'),
  lastError: text('last_error'),
});

/**
 * Stock added by receipt bookings, consumed by the next low-stock poll so the
 * same purchase does not reduce the Mealie list twice. Written in the same
 * transaction that marks the booking applied.
 */
export const lowStockAccountedRestocks = sqliteTable('low_stock_accounted_restocks', {
  effectId: text('effect_id').primaryKey(),
  grocyProductId: integer('grocy_product_id').notNull(),
  stockAmount: real('stock_amount').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
});
