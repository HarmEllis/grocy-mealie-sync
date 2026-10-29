'use client';

import { useState } from 'react';
import { Check, ChevronDown, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PROJECTION_LABELS } from '@/lib/shop/projection-reasons';
import type { ShopOverview } from '@/lib/shop/overview';
import { installationName } from '../shop-common';
import { EmptyState, Panel, RowItem, RowList } from '../shop-ui';

const HINT = 'Fix the mapping or unit; the next sync retries automatically.';

/** Shopping rows gm-sync could not project. `limit` shows a compact summary with a toggle. */
export function ProjectionReview({ overview, limit, onOpenReview }: { overview: ShopOverview; limit?: number; onOpenReview?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const rows = overview.projectionReview ?? [];
  const shown = limit && !expanded ? rows.slice(0, limit) : rows;
  const collapsible = Boolean(limit) && rows.length > (limit ?? 0);
  return (
    <Panel
      title="Not sent to retailer"
      icon={<TriangleAlert className="size-4" />}
      subtitle={`Reasons from the latest shopping projection. ${HINT}`}
      tools={onOpenReview && rows.length ? <Button size="sm" variant="outline" onClick={onOpenReview}>Open in Review</Button> : null}
    >
      {rows.length === 0 ? <EmptyState title="No blocked shopping rows reported." tone="good">Every row gm-sync wanted to project reached its retailer list.</EmptyState> : (
        <RowList>
          {shown.map((row, index) => (
            <RowItem key={`${row.installationId}:${row.revisionId}:${index}`}>
              <p className="font-semibold">{row.label} · {installationName(overview, row.installationId)}</p>
              <p className="text-text-2">{PROJECTION_LABELS[row.reason]}</p>
            </RowItem>
          ))}
        </RowList>
      )}
      {collapsible ? (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2 md:px-5">
          <Button size="sm" variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
            {expanded ? <Check className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded ? `Show first ${limit} only` : `Show all ${rows.length}`}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}
