import { z } from 'zod';
import {
  getInstallation,
  installationSettingsPatchSchema,
  renameInstallation,
  revokeInstallation,
  updateInstallationSettings,
} from '@/lib/plugins/installations';
import { CLOSE_CODES } from '@/lib/plugins/protocol/v1';
import { getPluginGateway, getShopWorker } from '@/lib/plugins/runtime';
import { getLedgerActivatedAt } from '@/lib/shop/ledger';
import { readJson, ShopApiError, shopRoute } from '@/lib/shop/api-helpers';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  settings: installationSettingsPatchSchema.optional(),
}).strict();

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return shopRoute('Update plugin installation', async () => {
    const { id } = await context.params;
    const body = patchSchema.parse(await readJson(request));
    const existing = getInstallation(id);
    if (!existing || existing.revokedAt) throw new ShopApiError(404, 'Installation not found');
    if (body.name) renameInstallation(id, body.name);
    if (body.settings) updateInstallationSettings(id, body.settings, { ledgerActivatedAt: getLedgerActivatedAt() });
    getShopWorker()?.requestListSync(id);
    return { installation: getInstallation(id) };
  });
}

/** Revoke: the token stops working immediately and the live session is closed. */
export async function DELETE(_request: Request, context: Context) {
  return shopRoute('Revoke plugin installation', async () => {
    const { id } = await context.params;
    const installation = revokeInstallation(id);
    if (!installation) throw new ShopApiError(404, 'Installation not found');
    getPluginGateway()?.closeInstallation(id, CLOSE_CODES.revoked, 'Installation revoked');
    return { ok: true };
  });
}
