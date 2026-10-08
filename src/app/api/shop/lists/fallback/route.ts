import { z } from 'zod';
import { getShopWorker } from '@/lib/plugins/runtime';
import { readJson, shopRoute } from '@/lib/shop/api-helpers';
import { setListFallbackMode } from '@/lib/shop/note-preferences';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  installationId: z.string().min(1).max(64),
  retailerProductId: z.string().min(1).max(128),
  mode: z.enum(['note', 'product']),
}).strict();

/**
 * Show a preferred retailer product as a free-text note on this account's
 * shared list, or as the product again. Stores the choice only; the list sync
 * makes the staged change.
 */
export async function POST(request: Request) {
  return shopRoute('Set shopping list fallback', async () => {
    const result = setListFallbackMode(bodySchema.parse(await readJson(request)));
    getShopWorker()?.requestListSync(result.installationId);
    return result;
  });
}
