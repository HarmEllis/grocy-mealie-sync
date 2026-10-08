import { z } from 'zod';
import { getInstallation } from '@/lib/plugins/installations';
import { getPluginGateway } from '@/lib/plugins/runtime';
import { upsertRetailerProducts } from '@/lib/shop/retailer-catalog';
import { referenceReceiptProductIds, pullReferenceReceipts } from '@/lib/shop/receipts';
import { readJson, ShopApiError, shopRoute, withSyncLock } from '@/lib/shop/api-helpers';
const schema = z.object({ installationId: z.string().min(1).max(64), limit: z.union([z.literal(5), z.literal(10)]).default(5) }).strict();
export async function POST(request: Request) {
  return shopRoute('Read recent receipts for setup', async () => {
    const { installationId, limit } = schema.parse(await readJson(request));
    return withSyncLock(async () => {
      const installation = getInstallation(installationId);
      const gateway = getPluginGateway();
      if (!installation || installation.revokedAt) throw new ShopApiError(404, 'Installation not found');
      if (!gateway?.getSession(installationId)) throw new ShopApiError(503, 'The plugin is not connected');
      if (installation.settings.boundAccountKey && installation.settings.boundAccountKey !== installation.accountKey) throw new ShopApiError(409, 'The retailer account binding changed');
      if (!installation.accountKey) throw new ShopApiError(400, 'Sign in to the retailer first');
      const checkAccount = () => {
        const current = getInstallation(installationId);
        if (!current || current.revokedAt || current.accountKey !== installation.accountKey) throw new ShopApiError(409, 'The retailer account changed while fetching receipts');
      };
      const result = await pullReferenceReceipts(installation, {
        listReceipts: async params => { const result = await gateway.call(installationId, 'receipts.list', params); checkAccount(); return result; },
        getReceipt: async receiptId => { const result = await gateway.call(installationId, 'receipts.get', { receiptId }); checkAccount(); return result; },
        now: () => new Date(),
      }, limit);
      let catalogueWarning: string | null = null;
      if (installation.manifest?.capabilities.includes('catalog') && installation.providerId) {
        const ids = referenceReceiptProductIds(installation.providerId, installation.accountKey!, result.externalReceiptIds);
        try {
          for (let offset = 0; offset < ids.length; offset += 200) {
            const catalogue = await gateway.call(installationId, 'catalog.get', { ids: ids.slice(offset, offset + 200) });
            checkAccount();
            upsertRetailerProducts(installation.providerId, catalogue.products);
          }
        } catch { catalogueWarning = 'Receipts are available, but some catalogue package details could not be loaded'; }
      }
      return { ...result, catalogueWarning };
    });
  });
}
