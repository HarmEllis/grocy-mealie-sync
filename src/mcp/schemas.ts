import { z } from 'zod';

export const productRefSchema = z.string().trim().min(1).describe(
  'Accepts mapping:<id>, grocy:<id>, mealie:<id>, or a raw Grocy numeric id. Use products.search to find the productRef first.',
);

export const verifiedGrocyUnitIdSchema = z.number().int().positive().describe(
  'Verified existing Grocy unit id only. Inspect units.list_catalog first and stop if the correct unit is unclear.',
);
