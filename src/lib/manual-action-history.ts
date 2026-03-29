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

interface ManualActionRecordInput {
  status: HistoryRunStatus;
  message: string;
  summary?: unknown;
  events?: HistoryEventInput[];
}

interface ManualActionSuccessInput extends Omit<ManualActionRecordInput, 'status'> {
  logMessage?: string;
}

interface ManualActionFailureInput extends Omit<ManualActionRecordInput, 'status'> {
  error: unknown;
  logMessage: string;
  status?: Exclude<HistoryRunStatus, 'success'>;
}

interface ManualActionOutcomeInput extends ManualActionRecordInput {
  logLevel?: 'info' | 'warn' | 'error';
  logMessage?: string;
  error?: unknown;
}

export function createManualHistoryRecorder(action: HistoryRunAction, historyErrorPrefix: string) {
  const startedAt = new Date();

  async function record(input: ManualActionRecordInput) {
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
  }

  async function recordOutcome(input: ManualActionOutcomeInput) {
    if (input.logMessage) {
      if (input.logLevel === 'error') {
        log.error(input.logMessage, input.error);
      } else if (input.logLevel === 'warn') {
        log.warn(input.logMessage, input.error);
      } else {
        log.info(input.logMessage);
      }
    }

    await record({
      status: input.status,
      message: input.message,
      summary: input.summary,
      events: input.events,
    });
  }

  return {
    startedAt,
    record,
    recordOutcome,
    async recordSuccess(input: ManualActionSuccessInput) {
      await recordOutcome({
        status: 'success',
        logLevel: 'info',
        logMessage: input.logMessage,
        message: input.message,
        summary: input.summary,
        events: input.events,
      });
    },
    async recordFailure(input: ManualActionFailureInput) {
      await recordOutcome({
        status: input.status ?? 'failure',
        logLevel: 'error',
        logMessage: input.logMessage,
        error: input.error,
        message: input.message,
        summary: input.summary,
        events: input.events,
      });
    },
  };
}
