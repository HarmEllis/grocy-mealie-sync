import { z } from 'zod';
import { getPluginGateway } from '@/lib/plugins/runtime';
import { PLUGIN_AUTH_TIMEOUT_MS, readJson, ShopApiError, shopRoute, withPluginAuthLock } from '@/lib/shop/api-helpers';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('begin') }).strict(),
  z.object({
    action: z.literal('submit'),
    stepId: z.string().min(1).max(128),
    values: z.record(z.string().max(40), z.string().max(4096)),
  }).strict(),
  z.object({ action: z.literal('logout') }).strict(),
]);

/**
 * Relay a retailer sign-in step to the plugin. Values (including secrets) are
 * forwarded once and never stored or logged; retailer tokens stay in the
 * plugin's own volume.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Plugin auth step', async () => {
    const { id } = await context.params;
    return withPluginAuthLock(id, async () => {
      const gateway = getPluginGateway();
      if (!gateway?.getSession(id)) throw new ShopApiError(503, 'The plugin is not connected');
      const body = bodySchema.parse(await readJson(request));
      const timeoutMs = PLUGIN_AUTH_TIMEOUT_MS;
      const step = body.action === 'begin'
        ? await gateway.call(id, 'auth.begin', {}, { timeoutMs })
        : body.action === 'submit'
          ? await gateway.call(id, 'auth.submit', { stepId: body.stepId, values: body.values }, { timeoutMs })
          : await gateway.call(id, 'auth.logout', {}, { timeoutMs });
      return { step };
    });
  });
}
