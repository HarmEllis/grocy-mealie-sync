import { getInstallation, recordAuthChanged, resetInstallationBinding } from '@/lib/plugins/installations';
import { CLOSE_CODES } from '@/lib/plugins/protocol/v1';
import { getPluginGateway } from '@/lib/plugins/runtime';
import { resetListOwnership } from '@/lib/shop/list-sync';
import { PLUGIN_AUTH_TIMEOUT_MS, pluginCallErrorSchema, ShopApiError, shopRoute, withPluginAuthLock, withSyncLock } from '@/lib/shop/api-helpers';

/** Sign out a connected plugin before resetting. Receipts stay stored per account. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Reset plugin binding', async () => {
    const { id } = await context.params;
    return withPluginAuthLock(id, async () => {
      const installation = getInstallation(id);
      if (!installation) throw new ShopApiError(404, 'Installation not found');
      const gateway = getPluginGateway();
      const supportsAuth = installation.manifest?.capabilities.includes('auth') ?? false;
      let signedOut = false;
      if (supportsAuth && gateway?.getSession(id)) {
        const step = await gateway.call(id, 'auth.logout', {}, { timeoutMs: PLUGIN_AUTH_TIMEOUT_MS }).catch(error => {
          const parsed = pluginCallErrorSchema.safeParse(error);
          if (parsed.success && (parsed.data.code === 'TIMEOUT' || parsed.data.outcome === 'unknown')) {
            const message = 'Plugin sign-out was not confirmed. The account binding has been kept; sign-out may still finish. Retry the binding reset in a moment.';
            throw Object.assign(new Error(message), { ...parsed.data, message });
          }
          throw error;
        });
        if (step.kind !== 'done') throw new ShopApiError(502, 'The plugin did not complete sign-out. The account binding has been kept.');
        const recorded = recordAuthChanged(id, { authState: 'unauthenticated', accountKey: null, accountLabel: null });
        if (!recorded.ok) throw new ShopApiError(409, recorded.reason);
        signedOut = true;
      }
      try {
        await withSyncLock(() => {
          if (resetListOwnership(id, () => { resetInstallationBinding(id); }) === 'busy') {
            throw new ShopApiError(409, 'A list sync is running. Try again in a moment.');
          }
        });
      } catch (error) {
        if (signedOut && error instanceof ShopApiError && error.status === 409) {
          throw new ShopApiError(409, 'The plugin was signed out, but a sync is running. Retry the binding reset in a moment.');
        }
        throw error;
      }
      gateway?.closeInstallation(id, CLOSE_CODES.serviceRestart, 'Binding reset; reconnect');
      // A rejected account hello has no live session. Keep offline reset available
      // so that account can reconnect, and expose that no remote logout took place.
      return { ok: true, signedOut, warning: supportsAuth && !signedOut
        ? 'The plugin was disconnected, so it could not be signed out. Its current account will bind on reconnect. To change accounts, reset again while connected before starting a fresh login.'
        : null };
    });
  });
}
