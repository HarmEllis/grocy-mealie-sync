declare global {
  // Lets server.mjs see whether startup ran, independent of Next.js module instances.
  // eslint-disable-next-line no-var
  var __gmsInstrumentationStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __gmsInstrumentationReady: boolean | undefined;
  // eslint-disable-next-line no-var
  var __gmsInstrumentationPromise: Promise<void> | undefined;
}

/**
 * Startup runs once per process. The promise lives on globalThis because
 * Next.js and the server.mjs development fallback may load this module from
 * different bundles; both share one migration and scheduler start.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startNodeRuntime } = await import('./instrumentation-node');
    globalThis.__gmsInstrumentationPromise ??= startNodeRuntime();
    return globalThis.__gmsInstrumentationPromise;
  }
}
