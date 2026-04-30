'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { openMappingWizard } from '@/components/mapping-wizard/events';
import { AppButton } from '@/components/redesign/primitives';
import { getPartialToastConfig, hasSyncActionError, type SyncActionResponse } from './toast';

const FULL_SYNC_STEPS = [
  '/api/sync/products',
  '/api/sync/grocy-to-mealie',
  '/api/sync/grocy-to-mealie/ensure',
  '/api/sync/grocy-to-mealie/in-possession',
  '/api/sync/mealie-to-grocy',
  '/api/sync/shopping-cleanup',
] as const;

const STEP_ACTIONS = [
  {
    label: 'Products and Units',
    subtitle: 'Sync mapped entities',
    endpoint: '/api/sync/products',
  },
  {
    label: 'Grocy to Mealie',
    subtitle: 'Products and units',
    endpoint: '/api/sync/grocy-to-mealie',
  },
  {
    label: 'Ensure Live-Stock',
    subtitle: 'Keep low stock visible',
    endpoint: '/api/sync/grocy-to-mealie/ensure',
  },
  {
    label: 'Reconcile Possession',
    subtitle: 'In possession states',
    endpoint: '/api/sync/grocy-to-mealie/in-possession',
  },
  {
    label: 'Mealie to Grocy',
    subtitle: 'Restock checked items',
    endpoint: '/api/sync/mealie-to-grocy',
  },
  {
    label: 'Shopping Cleanup',
    subtitle: 'Remove checked items',
    endpoint: '/api/sync/shopping-cleanup',
  },
] as const;

const UI_SYNC_TRIGGER_HEADERS = {
  'x-sync-trigger': 'ui',
};

async function runSyncRequest(endpoint: string, label: string): Promise<boolean> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: UI_SYNC_TRIGGER_HEADERS,
  });

  let body: SyncActionResponse | null = null;
  try {
    body = await response.json();
  } catch {
    // Not all endpoints return JSON consistently.
  }

  if (hasSyncActionError(response.ok, body)) {
    const errorMsg = body?.error || body?.message || `${response.status}`;
    toast.error(`${label} failed`, { description: errorMsg });
    return false;
  }

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
    return true;
  }

  if (body?.status === 'skipped') {
    toast.warning(`${label} skipped`, { description: body.message });
    return true;
  }

  toast.success(`${label} completed`, body?.summary ? { description: body.message } : undefined);
  return true;
}

export function DashboardSyncPanel() {
  const [runningKey, setRunningKey] = useState<string | null>(null);

  async function runFullSync() {
    if (runningKey) {
      return;
    }

    setRunningKey('full-sync');

    try {
      for (const endpoint of FULL_SYNC_STEPS) {
        const ok = await runSyncRequest(endpoint, 'Full sync');
        if (!ok) {
          break;
        }
      }
    } catch {
      toast.error('Full sync failed', { description: 'Network request failed' });
    } finally {
      setRunningKey(null);
    }
  }

  async function runSingleSync(endpoint: string, label: string) {
    if (runningKey) {
      return;
    }

    setRunningKey(endpoint);

    try {
      await runSyncRequest(endpoint, label);
    } catch {
      toast.error(`${label} failed`, { description: 'Network request failed' });
    } finally {
      setRunningKey(null);
    }
  }

  return (
    <div className="space-y-3">
      <AppButton
        className="h-11 w-full justify-center gap-2 text-sm"
        onClick={() => { void runFullSync(); }}
        disabled={runningKey !== null}
      >
        {runningKey === 'full-sync' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <span className="text-base leading-none">▶</span>
        )}
        {runningKey === 'full-sync' ? 'Running...' : 'Full sync'}
      </AppButton>

      <div className="border-t border-border" />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        {STEP_ACTIONS.map(action => {
          const isRunning = runningKey === action.endpoint;

          return (
            <AppButton
              key={action.endpoint}
              variant="outline"
              className="h-auto items-start justify-start rounded-lg border-border bg-bg-2 px-3 py-2 text-left hover:bg-bg-3/60"
              onClick={() => { void runSingleSync(action.endpoint, action.label); }}
              disabled={runningKey !== null}
            >
              {isRunning ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
              <span className="flex flex-col leading-tight">
                <span className="text-[13px] font-semibold text-text-1">{action.label}</span>
                <span className="text-[10px] font-normal text-text-3">{action.subtitle}</span>
              </span>
            </AppButton>
          );
        })}
      </div>
    </div>
  );
}
