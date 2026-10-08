import { listCatalogSearches } from '@/lib/shop/catalog-discovery';
import { z } from 'zod';
import { listRetailerMappings, listRetailerProducts, listSuggestions } from '@/lib/shop/retailer-catalog';
import { saveRetailerMapping } from '@/lib/shop/mapping-save';
import { readJson, ShopApiError, shopRoute } from '@/lib/shop/api-helpers';

export const dynamic = 'force-dynamic';

const upsertSchema = z.object({
  providerId: z.string().min(1).max(40),
  retailerProductId: z.string().min(1).max(128),
  targetKind: z.enum(['grocy_product', 'mealie_food']),
  targetId: z.string().min(1).max(128),
  targetName: z.string().min(1).max(200),
  role: z.enum(['preferred', 'alternative']).default('preferred'),
  baseUnitId: z.string().max(128).nullable().default(null),
  baseUnitName: z.string().max(100).nullable().default(null),
  packageBaseAmount: z.number().positive().finite().nullable().optional(),
  confirm: z.boolean().default(false),
  expectedTargetKey: z.string().min(1).max(220).optional(), replacesMappingId: z.string().min(1).max(200).optional(), reassign: z.boolean().default(false),
}).strict();

export async function GET(request: Request) {
  return shopRoute('List shop mappings', () => {
    const providerId = new URL(request.url).searchParams.get('providerId') ?? undefined;
    return {
      mappings: listRetailerMappings(providerId),
      products: listRetailerProducts(providerId),
      suggestions: listSuggestions(providerId),
      searches: listCatalogSearches(providerId),
    };
  });
}

export async function POST(request: Request) {
  return shopRoute('Save shop mapping', async () => {
    const input = upsertSchema.parse(await readJson(request));
    if (input.targetKind === 'grocy_product' && !/^\d+$/.test(input.targetId)) throw new ShopApiError(400, 'Grocy product IDs are numeric');
    // Returns { mapping, availability, warnings }; the unit is the target's authoritative base unit.
    return saveRetailerMapping(input);
  });
}
