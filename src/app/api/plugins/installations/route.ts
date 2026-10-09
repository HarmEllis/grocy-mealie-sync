import { z } from 'zod';
import { createInstallation } from '@/lib/plugins/installations';
import { installationViews } from '@/lib/shop/overview';
import { readJson, shopRoute } from '@/lib/shop/api-helpers';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();

export async function GET() {
  return shopRoute('List plugin installations', () => ({ installations: installationViews() }));
}

/** Create an installation. The token is returned once and only its hash is stored. */
export async function POST(request: Request) {
  return shopRoute('Create plugin installation', async () => {
    const { name } = createSchema.parse(await readJson(request));
    const { installation, token } = createInstallation(name);
    return { installation: { id: installation.id, name: installation.name, tokenHint: installation.tokenHint }, token };
  });
}
