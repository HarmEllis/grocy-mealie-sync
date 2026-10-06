import { rotateInstallationToken } from '@/lib/plugins/installations';
import { CLOSE_CODES } from '@/lib/plugins/protocol/v1';
import { getPluginGateway } from '@/lib/plugins/runtime';
import { ShopApiError, shopRoute } from '@/lib/shop/api-helpers';

/** Issue a new token (shown once); the old token and its session stop working. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return shopRoute('Rotate plugin token', async () => {
    const { id } = await context.params;
    const rotated = rotateInstallationToken(id);
    if (!rotated) throw new ShopApiError(404, 'Installation not found or revoked');
    getPluginGateway()?.closeInstallation(id, CLOSE_CODES.revoked, 'Token rotated');
    return { installation: { id, name: rotated.installation.name, tokenHint: rotated.installation.tokenHint }, token: rotated.token };
  });
}
