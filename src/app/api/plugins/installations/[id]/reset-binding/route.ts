import { getInstallation, resetInstallationBinding } from '@/lib/plugins/installations';
import { CLOSE_CODES } from '@/lib/plugins/protocol/v1';
import { getPluginGateway } from '@/lib/plugins/runtime';
import { resetListOwnership } from '@/lib/shop/list-sync';
import { ShopApiError, shopRoute, withSyncLock } from '@/lib/shop/api-helpers';

/**
 * Reviewed reset after the plugin switched retailer account or shopping list:
 * forget the account binding, the pinned list and all list ownership. Receipts
 * stay stored per account and are never re-booked.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Reset plugin binding', async () => {
    const { id } = await context.params;
    if (!getInstallation(id)) throw new ShopApiError(404, 'Installation not found');
    await withSyncLock(() => {
      if (resetListOwnership(id, () => { resetInstallationBinding(id); }) === 'busy') {
        throw new ShopApiError(409, 'A list sync is running. Try again in a moment.');
      }
    });
    getPluginGateway()?.closeInstallation(id, CLOSE_CODES.serviceRestart, 'Binding reset; reconnect');
    return { ok: true };
  });
}
