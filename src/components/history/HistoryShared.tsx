import Link from 'next/link';
import { ArrowLeft, History as HistoryIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button-styles';
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
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">History</h1>
            <p className="text-sm text-muted-foreground">Operational audit trail for sync runs and recovery actions</p>
          </div>
          <Link href="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="size-4" />
              History Disabled
            </CardTitle>
            <CardDescription>
              History storage is disabled because <code>HISTORY_RETENTION_DAYS=-1</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>No new history is stored while this env var is disabled.</p>
            <p>Existing history is cleared automatically when the app starts with this setting.</p>
          </CardContent>
        </Card>
      </div>
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
