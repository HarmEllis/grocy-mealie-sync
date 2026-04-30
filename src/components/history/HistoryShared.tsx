import { History as HistoryIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AppCard } from '@/components/redesign/primitives';
import { cn } from '@/lib/utils';
import { formatHistoryStatusLabel } from '@/lib/history-events';
import type { HistoryRunStatus } from '@/lib/history-types';

export function HistoryStatusBadge({ status }: { status: HistoryRunStatus }) {
  if (status === 'failure') {
    return <Badge variant="destructive">{formatHistoryStatusLabel(status)}</Badge>;
  }

  if (status === 'partial') {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
        {formatHistoryStatusLabel(status)}
      </Badge>
    );
  }

  if (status === 'skipped') {
    return <Badge variant="outline">{formatHistoryStatusLabel(status)}</Badge>;
  }

  return (
    <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-300">
      {formatHistoryStatusLabel(status)}
    </Badge>
  );
}

export function HistoryDisabledState() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text-1">History</h1>
        <p className="mt-1 text-sm text-text-2">Operational audit trail for sync runs and manual actions across the web UI and MCP server.</p>
      </div>

      <AppCard>
        <div className="flex items-center gap-2 text-base font-bold tracking-tight">
          <HistoryIcon className="size-4" />
          History Disabled
        </div>
        <p className="mt-2 text-sm text-text-2">
          History storage is disabled because <code>HISTORY_RETENTION_DAYS=-1</code>.
        </p>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>No new history is stored while this env var is disabled.</p>
          <p>Existing history is cleared automatically when the app starts with this setting.</p>
        </div>
      </AppCard>
    </div>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  const renderedValue = value === undefined ? 'undefined' : JSON.stringify(value, null, 2);

  return (
    <pre className={cn(
      'overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-5 whitespace-pre-wrap break-words',
    )}>
      {renderedValue}
    </pre>
  );
}
