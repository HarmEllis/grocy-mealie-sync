'use client';

import { useCallback, useState } from 'react';

/**
 * Runs one mutation at a time per list of buttons: while a request and its reload are in flight
 * `busy` is set, so a double click cannot send the same decision twice.
 */
export function useAction(): { busy: boolean; run: (action: () => Promise<unknown>) => Promise<void> } {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }, [busy]);
  return { busy, run };
}
