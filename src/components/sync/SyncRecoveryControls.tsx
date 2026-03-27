'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { hasSyncActionError, type SyncActionResponse } from './toast';

const UNLOCK_ENDPOINT = '/api/sync/unlock';

const UI_SYNC_TRIGGER_HEADERS = {
  'x-sync-trigger': 'ui',
};

export function SyncRecoveryControls() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);

  async function clearSyncLocks() {
    setRunning(true);
    try {
      const res = await fetch(UNLOCK_ENDPOINT, {
        method: 'POST',
        headers: UI_SYNC_TRIGGER_HEADERS,
      });
      let body: SyncActionResponse | null = null;
      try {
        body = await res.json();
      } catch {
        // Response body wasn't JSON.
      }

      if (hasSyncActionError(res.ok, body)) {
        const message = body?.error || body?.message || `${res.status}`;
        toast.error('Clear Sync Locks failed', { description: message });
        return;
      }

      if (body?.status === 'skipped') {
        toast.warning('Clear Sync Locks skipped', { description: body.message });
        return;
      }

      toast.success('Sync locks cleared', {
        description: body?.message ?? 'Restart the app that should own the scheduler.',
      });
      setConfirmOpen(false);
    } catch {
      toast.error('Clear Sync Locks failed', { description: 'Network request failed' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Stale Lock Recovery</AlertTitle>
          <AlertDescription>
            If startup is blocked by a stale scheduler lock, clear the locks and restart the app
            that should own the scheduler.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={running}
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Unlock className="size-4" />
            )}
            {running ? 'Clearing...' : 'Clear Sync Locks'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Crash recovery only.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={clearSyncLocks}
        running={running}
        title="Clear stale sync locks?"
        description={'Only continue if the active scheduler is gone. After clearing the locks, restart the app that should own the scheduler.'}
      />
    </>
  );
}
