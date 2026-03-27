'use client';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ConflictsTabData, MappingConflictRow } from './types';

interface ConflictsTabProps {
  data: ConflictsTabData;
  actionRunning: string | null;
  onCheckConflicts: () => void;
  onOpenSourceTab: (tab: 'products' | 'units') => void;
  onUnmapConflict: (conflict: MappingConflictRow) => void;
  onRecheckConflict: (conflict: MappingConflictRow) => void;
}

function formatTimestamp(value: string | Date | null): string {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function ConflictsTab({
  data,
  actionRunning,
  onCheckConflicts,
  onOpenSourceTab,
  onUnmapConflict,
  onRecheckConflict,
}: ConflictsTabProps) {
  const isRunning = !!actionRunning;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onCheckConflicts} disabled={isRunning}>
          {actionRunning === 'checkConflicts' ? 'Checking...' : 'Check Conflicts'}
        </Button>
      </div>

      <div className="min-h-0 min-w-0 flex-1 rounded-md border">
        <Table className="min-w-[1100px]" containerClassName="h-full min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Type</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="w-[160px]">Last Seen</TableHead>
              <TableHead className="w-[90px]">Hits</TableHead>
              <TableHead className="w-[240px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.conflicts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  No open conflicts.
                </TableCell>
              </TableRow>
            )}
            {data.conflicts.map(conflict => (
              <TableRow key={conflict.id}>
                <TableCell className="font-medium">{conflict.type}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p>{conflict.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      First seen: {formatTimestamp(conflict.firstSeenAt)}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatTimestamp(conflict.lastSeenAt)}</TableCell>
                <TableCell>{conflict.occurrences}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onOpenSourceTab(conflict.sourceTab)}>
                      Open Source Tab
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onRecheckConflict(conflict)} disabled={isRunning}>
                      Recheck
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onUnmapConflict(conflict)} disabled={isRunning}>
                      Unmap
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
