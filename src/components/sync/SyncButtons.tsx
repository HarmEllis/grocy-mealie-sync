'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { openMappingWizard } from '@/components/mapping-wizard/events';
import { getPartialToastConfig, hasSyncActionError, type SyncActionResponse } from './toast';

const syncActions = [
  { label: 'Sync Products & Units', endpoint: '/api/sync/products', icon: RefreshCw },
  { label: 'Grocy \u2192 Mealie', endpoint: '/api/sync/grocy-to-mealie', icon: ArrowRight },
  { label: 'Ensure Low-Stock in Mealie', endpoint: '/api/sync/grocy-to-mealie/ensure', icon: RefreshCw },
  { label: 'Reconcile In Possession', endpoint: '/api/sync/grocy-to-mealie/in-possession', icon: RefreshCw },
  { label: 'Mealie \u2192 Grocy', endpoint: '/api/sync/mealie-to-grocy', icon: ArrowLeftRight },
  { label: 'Clear Sync Lock', endpoint: '/api/sync/unlock', icon: RefreshCw },
] as const;

const UI_SYNC_TRIGGER_HEADERS = {
  'x-sync-trigger': 'ui',
};

export function SyncButtons() {
  const [running, setRunning] = useState<string | null>(null);

  async function triggerSync(endpoint: string, label: string) {
    setRunning(endpoint);
    try {
      const res = await fetch(endpoint, {
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
        let errorMsg = `${res.status}`;
        if (body?.error) errorMsg = body.error;
        else if (body?.message) errorMsg = body.message;
        toast.error(`${label} failed`, { description: errorMsg });
        return;
      }

      const description = body?.summary ? body.message : undefined;

      if (body?.status === 'partial') {
        const partialToast = getPartialToastConfig(endpoint, body);
        toast.warning(
          `${label} partially completed`,
          partialToast.mappingWizardTab
            ? {
              description: partialToast.description,
              action: {
                label: 'Open Mapping Wizard',
                onClick: () => openMappingWizard({ tab: partialToast.mappingWizardTab }),
              },
              duration: partialToast.duration,
            }
            : { description: partialToast.description },
        );
        return;
      }

      if (body?.status === 'skipped') {
        toast.warning(`${label} skipped`, { description: body.message });
        return;
      }

      toast.success(`${label} completed`, description ? { description } : undefined);
    } catch {
      toast.error(`${label} failed`, { description: 'Network request failed' });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {syncActions.map(action => {
        const Icon = action.icon;
        const isRunning = running === action.endpoint;
        return (
          <Button
            key={action.endpoint}
            variant="outline"
            size="sm"
            onClick={() => triggerSync(action.endpoint, action.label)}
            disabled={running !== null}
          >
            {isRunning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Icon className="size-4" />
            )}
            {isRunning ? 'Running...' : action.label}
          </Button>
        );
      })}
    </div>
  );
}
