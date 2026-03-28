import { log } from './logger';
import {
  recordHistoryRun,
  type HistoryEventCategory,
  type HistoryEventEntityKind,
  type HistoryEventInput,
  type HistoryRunAction,
  type HistoryRunStatus,
} from './history-store';

export function formatManualActionError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

export function buildManualHistoryEvent(input: {
  level: HistoryEventInput['level'];
  category: HistoryEventCategory;
  entityKind?: HistoryEventEntityKind;
  entityRef?: string | null;
  message: string;
  details?: unknown;
}): HistoryEventInput {
  return {
    level: input.level,
    category: input.category,
    entityKind: input.entityKind ?? null,
    entityRef: input.entityRef ?? null,
    message: input.message,
    details: input.details,
  };
}

export function createManualHistoryRecorder(action: HistoryRunAction, historyErrorPrefix: string) {
  const startedAt = new Date();

  return {
    startedAt,
    async record(input: {
      status: HistoryRunStatus;
      message: string;
      summary?: unknown;
      events?: HistoryEventInput[];
    }) {
      await recordHistoryRun({
        trigger: 'manual',
        action,
        status: input.status,
        message: input.message,
        startedAt,
        finishedAt: new Date(),
        summary: input.summary,
        events: input.events,
      }).catch((error) => log.error(historyErrorPrefix, error));
    },
  };
}
