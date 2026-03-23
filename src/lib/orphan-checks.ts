/**
 * Circuit breaker checks for orphan deletion.
 * Extracted for testability.
 */

export interface CircuitBreakerResult {
  allowed: boolean;
  reason?: string;
  statusCode?: number;
}

/**
 * Checks whether orphan deletion should proceed based on safety heuristics.
 *
 * @param upstreamItemCount - Number of items from the upstream source (Mealie foods/units)
 * @param grocyItemCount - Total number of items in Grocy
 * @param idsToDeleteCount - Number of IDs the caller wants to delete
 */
export function checkOrphanDeletionSafety(
  upstreamItemCount: number,
  grocyItemCount: number,
  idsToDeleteCount: number,
): CircuitBreakerResult {
  // If upstream returned 0 items, refuse — likely an API issue
  if (upstreamItemCount === 0) {
    return {
      allowed: false,
      reason: 'Upstream returned no items — refusing to delete to prevent data loss.',
      statusCode: 503,
    };
  }

  // If > 50% of Grocy items would be deleted, refuse
  if (grocyItemCount > 0 && idsToDeleteCount > grocyItemCount * 0.5) {
    return {
      allowed: false,
      reason: `Refusing to delete ${idsToDeleteCount} of ${grocyItemCount} items (>50%). This may indicate an upstream API issue.`,
      statusCode: 400,
    };
  }

  return { allowed: true };
}
