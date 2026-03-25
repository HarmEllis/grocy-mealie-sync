import { z } from 'zod';

// --- Mapping Wizard: Products ---

/** Schema for a single product mapping entry (products sync) */
export const productMappingEntrySchema = z.object({
  mealieFoodId: z.string(),
  grocyProductId: z.number(),
  grocyUnitId: z.number(),
});

/** Schema for the products sync request body */
export const productSyncRequestSchema = z.object({
  mappings: z.array(productMappingEntrySchema).max(500),
});

/** Schema for the products create request body */
export const productCreateRequestSchema = z.object({
  mealieFoodIds: z.array(z.string()).max(500),
  defaultGrocyUnitId: z.number(),
  unitOverrides: z.record(z.string(), z.number()).optional(),
});

// --- Mapping Wizard: Units ---

/** Schema for a single unit mapping entry (units sync) */
export const unitMappingEntrySchema = z.object({
  mealieUnitId: z.string(),
  grocyUnitId: z.number(),
});

/** Schema for the units sync request body */
export const unitSyncRequestSchema = z.object({
  mappings: z.array(unitMappingEntrySchema).max(500),
});

/** Schema for the units create request body */
export const unitCreateRequestSchema = z.object({
  mealieUnitIds: z.array(z.string()).max(500),
});

// --- Settings ---

/** Schema for the settings update request body */
export const settingsUpdateSchema = z.object({
  defaultUnitMappingId: z.string().nullable().optional(),
  mealieShoppingListId: z.string().nullable().optional(),
  autoCreateProducts: z.boolean().optional(),
  autoCreateUnits: z.boolean().optional(),
  stockOnlyMinStock: z.boolean().optional(),
});

// --- Orphan Deletion ---

/** Schema for orphan deletion confirmation request body */
export const orphanDeleteRequestSchema = z.object({
  confirm: z.literal(true),
  ids: z.array(z.string()).max(500),
});
