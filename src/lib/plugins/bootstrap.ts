import packageMetadata from '../../../package.json';
import { log } from '../logger';
import { getSchedulerRuntimeState } from '../sync/scheduler';
import { createPluginGateway } from './gateway';
import { authenticatePluginToken, recordAuthChanged, recordHello } from './installations';
import { CLOSE_CODES } from './protocol/v1';
import { getShopWorker, setPluginGateway } from './runtime';

/**
 * Create the plugin gateway and register it on `globalThis` for server.mjs.
 * Called from instrumentation after the scheduler started. Sessions are only
 * accepted while this process owns the scheduler.
 */
export function startPluginGateway(): void {
  const gateway = createPluginGateway({
    coreVersion: packageMetadata.version,
    authenticate: token => authenticatePluginToken(token),
    isSchedulerActive: () => getSchedulerRuntimeState().status === 'active',
    onHello: (installationId, hello) => {
      const result = recordHello(installationId, hello);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    },
    // Catch-up on every connect, independent of hints: pull receipts and sync the list.
    onSessionReady: (session) => {
      getShopWorker()?.requestReceiptPull(session.installationId);
      getShopWorker()?.requestListSync(session.installationId);
    },
    onEvent: (session, event, data) => {
      switch (event) {
        case 'auth.changed': {
          const result = recordAuthChanged(session.installationId, data as Parameters<typeof recordAuthChanged>[1]);
          if (!result.ok) {
            log.warn(`[Plugins] Installation ${session.installationId}: ${result.reason}`);
            getGatewayOrNull()?.closeInstallation(session.installationId, CLOSE_CODES.providerMismatch, 'Retailer account changed');
          }
          return;
        }
        case 'list.changed':
          getShopWorker()?.requestListSync(session.installationId);
          return;
        case 'receipts.available':
          getShopWorker()?.requestReceiptPull(session.installationId);
          return;
      }
    },
    log: { info: (...args) => log.info(...args), warn: (...args) => log.warn(...args) },
  });
  setPluginGateway(gateway);
  log.info('[Plugins] Shop plugin gateway ready at /api/plugins/connect');
}

function getGatewayOrNull() {
  return globalThis.__gmsPluginGateway ?? null;
}
