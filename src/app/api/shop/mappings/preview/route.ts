import { z } from 'zod';
import { mappingPreview } from '@/lib/shop/mapping-preview';
import { readJson, shopRoute } from '@/lib/shop/api-helpers';
const schema = z.object({ providerId: z.string().min(1).max(40), retailerProductId: z.string().min(1).max(128), targetKind: z.enum(['grocy_product', 'mealie_food']), targetId: z.string().min(1).max(128), baseUnitId: z.string().max(128).nullable().optional() }).strict();
export async function POST(request: Request) {
  return shopRoute('Preview mapping units', async () => mappingPreview(schema.parse(await readJson(request))));
}
