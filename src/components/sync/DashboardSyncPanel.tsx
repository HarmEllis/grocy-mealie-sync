'use client';

import { useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { openMappingWizard } from '@/components/mapping-wizard/events';
import { AppButton } from '@/components/redesign/primitives';
import { cn } from '@/lib/utils';
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

const SHOP_ACTIONS = [
  {
    label: 'Sync shop lists',
    subtitle: 'Send changes to retailer lists',
    endpoint: '/api/shop/run',
  },
  {
    label: 'Fetch receipts',
    subtitle: 'Check connected retailers now',
    endpoint: '/api/shop/receipts/pull',
  },
] as const;

const STEP_TRACKER = [
  { id: 'products', icon: '📦', endpoints: ['/api/sync/products'] },
  { id: 'ensure', icon: '✅', endpoints: ['/api/sync/grocy-to-mealie', '/api/sync/grocy-to-mealie/ensure'] },
  { id: 'reconcile', icon: '🔄', endpoints: ['/api/sync/grocy-to-mealie/in-possession', '/api/sync/mealie-to-grocy'] },
  { id: 'cleanup', icon: '🧹', endpoints: ['/api/sync/shopping-cleanup'] },
] as const;

const UI_SYNC_TRIGGER_HEADERS = {
  'x-sync-trigger': 'ui',
};

async function runSyncRequest(endpoint: string, label: string): Promise<boolean> {
  const isShopRequest = endpoint.startsWith('/api/shop/');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: isShopRequest ? { ...UI_SYNC_TRIGGER_HEADERS, 'Content-Type': 'application/json' } : UI_SYNC_TRIGGER_HEADERS,
    ...(isShopRequest ? { body: '{}' } : {}),
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

  toast.success(`${label} ${isShopRequest ? 'requested' : 'completed'}`, isShopRequest
    ? { description: 'Runs in the background for connected, enabled shop plugins.' }
    : body?.summary ? { description: body.message } : undefined);
  return true;
}

export function DashboardSyncPanel({ hasShopInstallations = false }: { hasShopInstallations?: boolean }) {
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  async function runFullSync() {
    if (runningKey) {
      return;
    }

    setRunningKey('full-sync');
    setCompletedSteps([]);
    setActiveStep(null);

    try {
      for (const endpoint of FULL_SYNC_STEPS) {
        setActiveStep(endpoint);
        const ok = await runSyncRequest(endpoint, 'Full sync');
        if (ok) {
          setCompletedSteps(prev => (prev.includes(endpoint) ? prev : [...prev, endpoint]));
        }
        if (!ok) {
          break;
        }
      }
    } catch {
      toast.error('Full sync failed', { description: 'Network request failed' });
    } finally {
      setRunningKey(null);
      setActiveStep(null);
    }
  }

  async function runSingleSync(endpoint: string, label: string) {
    if (runningKey) {
      return;
    }

    setRunningKey(endpoint);
    setCompletedSteps([]);
    setActiveStep(endpoint);

    try {
      const ok = await runSyncRequest(endpoint, label);
      if (ok) {
        setCompletedSteps([endpoint]);
      }
    } catch {
      toast.error(`${label} failed`, { description: 'Network request failed' });
    } finally {
      setRunningKey(null);
      setActiveStep(null);
    }
  }

  return (
    <div className="space-y-3.5">
      <AppButton
        className={cn(
          'h-11 w-full justify-center gap-2 text-sm',
          'bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-[0_0_24px_var(--accent-glow),0_4px_16px_color-mix(in_oklab,var(--accent)_30%,transparent)]',
        )}
        onClick={() => { void runFullSync(); }}
        disabled={runningKey !== null}
      >
        {runningKey === 'full-sync' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Play className="size-4 fill-current stroke-1" />
        )}
        {runningKey === 'full-sync' ? 'Running...' : 'Full sync'}
      </AppButton>

      {(runningKey !== null || completedSteps.length > 0) ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            {STEP_TRACKER.map((step, index) => {
              const isDone = step.endpoints.every(endpoint => completedSteps.includes(endpoint));
              const isActive = activeStep !== null && step.endpoints.some(endpoint => endpoint === activeStep);

              return (
                <div key={step.id} className="flex flex-1 items-center gap-1">
                  <span
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all',
                      isDone
                        ? 'bg-primary shadow-[0_0_8px_var(--accent-glow)]'
                        : isActive
                          ? 'bg-primary/40'
                          : 'bg-white/8',
                    )}
                  />
                  {index < STEP_TRACKER.length - 1 ? <span className="w-1" /> : null}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {STEP_TRACKER.map(step => {
              const isDone = completedSteps.includes(step.id);
              const isActive = activeStep === step.id;
              return (
                <span
                  key={`${step.id}-label`}
                  className={cn(
                    'text-center text-[10px]',
                    isDone ? 'text-primary' : isActive ? 'text-text-1' : 'text-text-3',
                  )}
                >
                  {isDone ? '✓' : isActive ? '⟳' : '·'} {step.icon}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="border-t border-white/10" />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        {[...STEP_ACTIONS, ...(hasShopInstallations ? SHOP_ACTIONS : [])].map(action => {
          const isRunning = runningKey === action.endpoint;
          const isShopAction = action.endpoint.startsWith('/api/shop/');

          return (
            <AppButton
              key={action.endpoint}
              variant="outline"
              className={cn(
                'h-auto cursor-pointer items-start justify-start rounded-lg border !border-border !bg-bg-2 dark:!bg-bg-2 px-3 py-2 text-left',
                'hover:bg-bg-3',
                isRunning && 'border-primary/40 bg-primary/10',
              )}
              onClick={() => { void runSingleSync(action.endpoint, action.label); }}
              disabled={runningKey !== null}
            >
              {isRunning ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
              <span className="flex min-w-0 flex-col whitespace-normal leading-tight">
                <span className="text-[13px] font-semibold text-text-1">{action.label}</span>
                <span className="text-[10px] font-normal text-text-2">{action.subtitle}</span>
                {isShopAction ? <span className="mt-1 text-[10px] font-normal text-text-3">Separate action · excluded from Full sync</span> : null}
              </span>
            </AppButton>
          );
        })}
      </div>
      {hasShopInstallations ? <p className="text-xs text-text-3">Shop actions run separately in the background and are excluded from Full sync. Fetched receipts are processed during the next scheduled sync. Check Shopping → Diagnostics for progress and errors.</p> : null}
    </div>
  );
}
