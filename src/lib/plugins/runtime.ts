import type { PluginGateway } from './gateway';

/**
 * Process-wide handles for the shop plugin runtime.
 *
 * Next.js bundles instrumentation, route handlers and server components
 * separately, so module-level state is not shared between them. The gateway
 * and worker live on `globalThis`: `server.mjs` routes upgrades to the
 * gateway, and route handlers reach live sessions and the worker through the
 * accessors below. Never cache these in module scope.
 */
export interface ShopWorkerHandle {
  requestListSync: (installationId?: string) => void;
  requestReceiptPull: (installationId?: string) => void;
  runNow: () => Promise<void>;
}

declare global {
  // eslint-disable-next-line no-var
  var __gmsPluginGateway: PluginGateway | undefined;
  // eslint-disable-next-line no-var
  var __gmsShopWorker: ShopWorkerHandle | undefined;
}

export function getPluginGateway(): PluginGateway | null {
  return globalThis.__gmsPluginGateway ?? null;
}

export function setPluginGateway(gateway: PluginGateway | undefined): void {
  const previous = globalThis.__gmsPluginGateway;
  if (previous && previous !== gateway) previous.dispose();
  globalThis.__gmsPluginGateway = gateway;
}

export function getShopWorker(): ShopWorkerHandle | null {
  return globalThis.__gmsShopWorker ?? null;
}

export function setShopWorker(worker: ShopWorkerHandle | undefined): void {
  globalThis.__gmsShopWorker = worker;
}
