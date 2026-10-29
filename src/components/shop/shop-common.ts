import { toast } from 'sonner';
import { apiJson } from './api';
import type { ShopOverview } from '@/lib/shop/overview';
import type { ShopDashboardStatus } from '@/lib/shop/status';
import { needsProjectionAttention } from '@/lib/shop/projection-reasons';

export const PAUSE_LABELS: Record<string, string> = {
  reduced_by_other: 'Someone reduced this line',
  line_missing: 'The line disappeared',
  duplicate_lines: 'The product is on the list more than once',
  line_reused: 'The line now holds another product',
  notes_unsupported: 'Product discontinued; this plugin cannot add a text item',
};

export const REVIEW_LABELS: Record<string, string> = {
  unknown_product: 'The retailer did not identify the product',
  mapping_missing: 'No product mapping yet',
  mapping_unconfirmed: 'The package amount is not confirmed',
  invalid_quantity: 'Return or correction',
  unit_mismatch: 'The receipt unit does not fit the mapping',
  mapping_unit_changed: 'The product unit changed; confirm the mapping again',
  ambiguous_credit: 'Several manual checks could match',
};

export function money(cents: number | null | undefined): string {
  return typeof cents === 'number' ? (cents / 100).toFixed(2) : '';
}

export function when(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export async function post(url: string, body: unknown, success: string): Promise<boolean> {
  try {
    await apiJson(url, { method: 'POST', body: JSON.stringify(body) });
    toast.success(success);
    return true;
  } catch (error) {
    toast.error('Action failed', { description: (error as Error).message });
    return false;
  }
}

export function installationName(overview: ShopOverview, id: string): string {
  return overview.installations.find(installation => installation.id === id)?.name ?? id;
}

export function pausedLines(overview: ShopOverview): ShopOverview['lines'] {
  return overview.lines.filter(line => line.pausedReason && line.pausedReason !== 'released');
}

export function blockedProjectionRows(overview: ShopOverview): ShopOverview['projectionReview'] {
  return (overview.projectionReview ?? []).filter(row => needsProjectionAttention(row.reason));
}

/** Everything that waits for a decision, as shown on the badge, hero and Review tab. */
export function attentionCount(overview: ShopOverview | null): number {
  if (!overview) return 0;
  return overview.review.length + blockedProjectionRows(overview).length + overview.discrepancies.length
    + overview.effects.length + pausedLines(overview).length;
}

/** Latest receipt fetch attempt and earliest upcoming one across all plugins. */
export function receiptCheckWindow(status: ShopDashboardStatus): { last: string | null; next: string | null } {
  let last: string | null = null;
  let next: string | null = null;
  for (const receipt of status.receipts) {
    if (receipt.lastCheckedAt && (!last || Date.parse(receipt.lastCheckedAt) > Date.parse(last))) last = receipt.lastCheckedAt;
    if (receipt.nextCheckAt && (!next || Date.parse(receipt.nextCheckAt) < Date.parse(next))) next = receipt.nextCheckAt;
  }
  return { last, next };
}
