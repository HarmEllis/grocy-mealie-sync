import { getShopWorker } from '@/lib/plugins/runtime';
import { ShopApiError, shopRoute } from '@/lib/shop/api-helpers';

/** Run the plugin I/O worker (list sync and due receipt pulls) now. */
export async function POST() {
  return shopRoute('Run shop worker', async () => {
    const worker = getShopWorker();
    if (!worker) throw new ShopApiError(503, 'The shop worker runs on the instance that owns the scheduler');
    worker.requestListSync();
    return { ok: true };
  });
}
