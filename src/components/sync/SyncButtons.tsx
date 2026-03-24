'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const syncActions = [
  { label: 'Sync Products & Units', endpoint: '/api/sync/products', icon: RefreshCw },
  { label: 'Grocy \u2192 Mealie', endpoint: '/api/sync/grocy-to-mealie', icon: ArrowRight },
  { label: 'Mealie \u2192 Grocy', endpoint: '/api/sync/mealie-to-grocy', icon: ArrowLeftRight },
] as const;

export function SyncButtons() {
  const [running, setRunning] = useState<string | null>(null);

  async function triggerSync(endpoint: string, label: string) {
    setRunning(endpoint);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        let errorMsg = `${res.status}`;
        try {
          const body = await res.json();
          if (body.error) errorMsg = body.error;
          else if (body.message) errorMsg = body.message;
        } catch { /* response body wasn't JSON */ }
        toast.error(`${label} failed`, { description: errorMsg });
        return;
      }
      toast.success(`${label} completed`);
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
