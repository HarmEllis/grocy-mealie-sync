import type { HistoryEventInput } from '../history-store';
import type { HistorySystem } from '../history-types';

export function describeSyncError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Call after each confirmed upstream write, so partial runs retain their mutations. */
export function activityEvent(input: {
  message: string;
  reason: string;
  source: HistorySystem;
  target: HistorySystem;
  productName?: string;
  entityRef?: string;
  entityKind?: HistoryEventInput['entityKind'];
  category?: HistoryEventInput['category'];
  level?: HistoryEventInput['level'];
  details?: Record<string, unknown>;
}): HistoryEventInput {
  return {
    ...input,
    kind: input.level && input.level !== 'info' ? 'issue' : 'mutation',
    level: input.level ?? 'info',
    category: input.category ?? 'sync',
    entityKind: input.entityKind ?? 'product',
    createdAt: new Date(),
  };
}
