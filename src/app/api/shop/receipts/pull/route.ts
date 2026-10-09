import { z } from 'zod';
import { getShopWorker } from '@/lib/plugins/runtime';
import { readJson, ShopApiError, shopRoute } from '@/lib/shop/api-helpers';

const bodySchema = z.object({ installationId: z.string().max(64).optional() }).strict();

/** Ask the worker for a durable receipt pull now. */
export async function POST(request: Request) {
  return shopRoute('Request receipt pull', async () => {
    const { installationId } = bodySchema.parse(await readJson(request));
    const worker = getShopWorker();
    if (!worker) throw new ShopApiError(503, 'The shop worker runs on the instance that owns the scheduler');
    worker.requestReceiptPull(installationId);
    return { ok: true };
  });
}
