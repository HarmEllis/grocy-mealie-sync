import { z } from 'zod';
import { getShopWorker } from '@/lib/plugins/runtime';
import { resolvePausedListLine } from '@/lib/shop/list-sync';
import { readJson, ShopApiError, shopRoute } from '@/lib/shop/api-helpers';

const bodySchema = z.object({
  installationId: z.string().min(1).max(64),
  retailerProductId: z.string().min(1).max(128),
  resolution: z.enum(['user_units_removed', 'readd', 'release']),
}).strict();

/** Explain a paused shared-list line so syncing can continue. */
export async function POST(request: Request) {
  return shopRoute('Resolve paused list line', async () => {
    const body = bodySchema.parse(await readJson(request));
    const resolved = resolvePausedListLine(body.installationId, body.retailerProductId, body.resolution);
    if (resolved === 'busy') throw new ShopApiError(409, 'The list is syncing right now. Try again in a moment.');
    if (!resolved) throw new ShopApiError(404, 'Line is not paused');
    getShopWorker()?.requestListSync(body.installationId);
    return { ok: true };
  });
}
