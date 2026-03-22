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
]);

export const syncState = sqliteTable('sync_state', {
  id: text('id').primaryKey(),
  stateData: text('state_data').notNull(), // JSON blob for lastGrocyPoll, lastMealiePoll, etc.
});
