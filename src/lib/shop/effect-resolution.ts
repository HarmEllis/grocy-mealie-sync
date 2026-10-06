import { completeEffect, getEffect } from './ledger';
import { applyGrocyAddSideEffects } from './effect-hooks';
import type { GrocyAddPayload } from './effect-runners';

/** User decisions for effects whose outcome is unknown. */
export type UnknownResolution =
  | { action: 'booked_elsewhere'; transactionId?: string; note?: string }
  | { action: 'not_booked_retry' }
  | { action: 'skip' };

/**
 * Apply a user decision. Must run under the sync lock: "booked elsewhere" runs
 * the same applied bookkeeping as an automatic booking, in one transaction.
 */
export function resolveUnknownEffect(effectId: string, resolution: UnknownResolution, now = new Date()): boolean {
  const effect = getEffect<GrocyAddPayload>(effectId);
  if (!effect) return false;
  const resolvedAt = now.toISOString();
  switch (resolution.action) {
    case 'booked_elsewhere':
      return completeEffect(effectId, {
        status: 'applied',
        externalRef: resolution.transactionId ?? null,
        evidence: { resolution: 'booked_elsewhere', resolvedAt, note: resolution.note ?? null },
        fromStatuses: ['unknown'],
      }, effect.kind === 'grocy_add'
        ? tx => applyGrocyAddSideEffects(tx, effect, { writeCheckGuardToState: true, now })
        : undefined, now);
    case 'not_booked_retry':
      return completeEffect(effectId, {
        status: 'not_applied',
        evidence: { resolution: 'not_booked_retry', resolvedAt },
        fromStatuses: ['unknown'],
      }, undefined, now);
    case 'skip':
      return completeEffect(effectId, {
        status: 'cancelled',
        evidence: { resolution: 'skip', resolvedAt },
        fromStatuses: ['unknown', 'not_applied', 'planned'],
      }, undefined, now);
  }
}
