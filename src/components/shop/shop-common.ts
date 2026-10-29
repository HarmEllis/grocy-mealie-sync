import { toast } from 'sonner';
import { apiJson } from './api';
import type { ShopOverview } from '@/lib/shop/overview';
import type { ShopDashboardStatus } from '@/lib/shop/status';
import { needsProjectionAttention } from '@/lib/shop/projection-reasons';
import type { ProjectionReviewReason } from '@/lib/shop/projection';

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

export async function post(url: string, body: unknown, success: string): Promise<boolean> {
  try {
    const result = await apiJson<{ status?: unknown; message?: unknown } | null>(url, { method: 'POST', body: JSON.stringify(body) });
    // Some resolutions answer 200 with the outcome in the body: a refused correction is not a success, and an
    // unknown outcome must be shown as such while the page reloads to pick up the new open effect.
    const message = typeof result?.message === 'string' ? result.message : undefined;
    if (result?.status === 'failed') { toast.error('Action failed', { description: message }); return false; }
    if (result?.status === 'unknown') { toast.warning('Outcome uncertain', { description: message }); return true; }
    toast.success(success);
    return true;
  } catch (error) {
    toast.error('Action failed', { description: (error as Error).message });
    return false;
  }
}

/** Name of an installation; stored receipts can outlive the installation they came from. */
export function installationName(overview: ShopOverview, id: string | null | undefined): string {
  return overview.installations.find(installation => installation.id === id)?.name ?? id ?? 'Unknown plugin';
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

/** Short badge text per blocked-row reason; the full sentence stays `PROJECTION_LABELS`. */
export const PROJECTION_SHORT: Record<ProjectionReviewReason, string> = {
  no_food: 'No product',
  no_retailer_mapping: 'No preferred retailer product mapped',
  mapping_unconfirmed: 'Mapping unconfirmed',
  mapping_unit_changed: 'Mapped base unit changed, confirm amount again',
  unknown_product: 'Grocy product or stock unit missing',
  missing_unit: 'Missing unit',
  purchase_unit_ambiguous: 'Purchase unit differs from stock unit',
  no_conversion: 'No conversion between Mealie unit and base unit',
};

/** Where each blocked-row reason is fixed. Products opens with the row's name as the search. */
export type FixTab = 'todo' | 'mapped' | 'attention';
export const PROJECTION_FIX: Record<ProjectionReviewReason, { label: string; target: 'products' | 'conversions' | 'none'; tab?: FixTab }> = {
  // A free-text row has no ingredient, so there is no product to open: the fix is choosing an ingredient in Mealie.
  no_food: { label: '', target: 'none' },
  no_retailer_mapping: { label: 'Open the mapping', target: 'products', tab: 'todo' },
  // These only occur for rows that already have a preferred mapping, so they live under Mapped or Needs attention.
  mapping_unconfirmed: { label: 'Confirm the amount', target: 'products', tab: 'attention' },
  mapping_unit_changed: { label: 'Re-confirm the conversion', target: 'products', tab: 'attention' },
  unknown_product: { label: 'Open the product', target: 'products', tab: 'mapped' },
  missing_unit: { label: 'Open the mapping', target: 'products', tab: 'mapped' },
  purchase_unit_ambiguous: { label: 'Set the package amount', target: 'products', tab: 'mapped' },
  no_conversion: { label: 'Add a conversion', target: 'conversions' },
};

/** Sub-product rows are labelled `Ingredient (Product)`; the queue lists the product. */
export function projectionSearchTerm(label: string): string {
  return label.match(/\(([^()]+)\)\s*$/)?.[1].trim() || label;
}
