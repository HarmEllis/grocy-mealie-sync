'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight, Clock, Link2, TriangleAlert } from 'lucide-react';
import { PROJECTION_LABELS } from '@/lib/shop/projection-reasons';
import type { ShopOverview } from '@/lib/shop/overview';
import { installationName, PROJECTION_FIX, PROJECTION_SHORT } from '../shop-common';
import { Badge, DButton, EmptyState, Panel, PluginChip, RowItem, RowList } from '../shop-ui';

const HINT = 'Fix the mapping or the unit; the next sync retries every row automatically.';

type Row = NonNullable<ShopOverview['projectionReview']>[number];

export function ProjectionRows({ overview, rows, openProducts }: { overview: ShopOverview; rows: Row[]; openProducts: (query: string) => void }) {
  return (
    <RowList>
      {rows.map((row, index) => {
        const fix = PROJECTION_FIX[row.reason];
        return (
          <RowItem
            key={`${row.installationId}:${row.revisionId}:${index}`}
            testId="projection-row"
            actions={fix.target === 'conversions'
              ? <Link href="/conversions" className="button ghost"><Link2 className="size-3.5" /> {fix.label}</Link>
              : <DButton variant="ghost" onClick={() => openProducts(row.label)}><Link2 className="size-3.5" /> {fix.label}</DButton>}
          >
            <strong>{row.label}</strong>
            <div className="row-sub"><PluginChip name={installationName(overview, row.installationId)} /></div>
            <div className="row-badges"><Badge tone="warning">{PROJECTION_SHORT[row.reason]}</Badge></div>
            <p className="row-reason">{PROJECTION_LABELS[row.reason]}</p>
          </RowItem>
        );
      })}
    </RowList>
  );
}

/** Shopping rows gm-sync could not project. `limit` shows a compact summary with a toggle (Overview). */
export function ProjectionReview({ overview, limit, onOpenReview, openProducts }: {
  overview: ShopOverview;
  limit?: number;
  onOpenReview?: () => void;
  openProducts: (query: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = overview.projectionReview ?? [];
  const shown = limit && !expanded ? rows.slice(0, limit) : rows;
  const collapsible = Boolean(limit) && rows.length > (limit ?? 0);
  return (
    <Panel
      testId="panel-projection"
      title="Not sent to retailer"
      icon={<TriangleAlert className="size-4" />}
      subtitle={`Shopping rows gm-sync wanted to project but could not. Nothing is lost: each row is retried on the next sync once its cause is fixed.${collapsible ? ` Showing ${expanded ? 'all' : `the first ${limit}`} of ${rows.length}.` : ''}`}
      footer={collapsible || rows.length === 0 ? undefined : <><Clock className="size-3.5" /><span>{HINT}</span></>}
    >
      {rows.length === 0
        ? <EmptyState tone="good" title="No blocked shopping rows reported">The latest projection held no shopping row back.</EmptyState>
        : <ProjectionRows overview={overview} rows={shown} openProducts={openProducts} />}
      {collapsible ? (
        <div className="show-more">
          <DButton variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
            <ChevronRight className="size-3.5" /> {expanded ? `Show first ${limit} only` : `Show all ${rows.length}`}
          </DButton>
          {onOpenReview ? <DButton variant="ghost" onClick={onOpenReview}><ArrowRight className="size-3.5" /> Open in Review</DButton> : null}
          <p>{HINT}</p>
        </div>
      ) : null}
    </Panel>
  );
}
