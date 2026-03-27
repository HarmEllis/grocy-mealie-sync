import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
  category: text('category').notNull(),
  entityKind: text('entity_kind'),
  entityRef: text('entity_ref'),
  message: text('message').notNull(),
  detailsJson: text('details_json'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  uniqueIndex('idx_history_events_run_id_created_at').on(table.runId, table.createdAt, table.id),
]);
