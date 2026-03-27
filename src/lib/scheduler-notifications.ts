import { config } from './config';
import { log } from './logger';

export type SchedulerCycleType = 'initial' | 'poll' | 'product_sync';
export type SchedulerCycleStatus = 'success' | 'partial' | 'failure';
export type SchedulerStepName = 'product_sync' | 'mealie_to_grocy' | 'grocy_to_mealie' | 'conflict_check';
export type SchedulerStepStatus = 'success' | 'failure';

export interface SchedulerStepResult {
  name: SchedulerStepName;
  status: SchedulerStepStatus;
  error?: string;
}

export interface SchedulerCycleSummary {
  cycleType: SchedulerCycleType;
  status: SchedulerCycleStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: SchedulerStepResult[];
}

interface SummarizeSchedulerCycleInput {
  cycleType: SchedulerCycleType;
  startedAt: Date;
  finishedAt: Date;
  steps: SchedulerStepResult[];
}

function toCycleStatus(steps: SchedulerStepResult[]): SchedulerCycleStatus {
  const failureCount = steps.filter(step => step.status === 'failure').length;

  if (failureCount === 0) {
    return 'success';
  }

  if (failureCount === steps.length) {
    return 'failure';
  }

  return 'partial';
}

function formatStepList(steps: SchedulerStepResult[], status: SchedulerStepStatus): string {
  const matchingSteps = steps.filter(step => step.status === status);

  if (matchingSteps.length === 0) {
    return 'none';
  }

  return matchingSteps.map(step => {
    if (status === 'failure' && step.error) {
      return `${step.name} (${step.error})`;
    }

    return step.name;
  }).join(', ');
}

function getHealthchecksUrl(summary: SchedulerCycleSummary): string | null {
  if (!config.healthchecksPingUrl) {
    return null;
  }

  if (summary.status === 'success') {
    return config.healthchecksPingUrl;
  }

  return `${config.healthchecksPingUrl.replace(/\/+$/, '')}/fail`;
}

export function summarizeSchedulerCycle({
  cycleType,
  startedAt,
  finishedAt,
  steps,
}: SummarizeSchedulerCycleInput): SchedulerCycleSummary {
  return {
    cycleType,
    status: toCycleStatus(steps),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    steps,
  };
}

export function buildHealthchecksBody(summary: SchedulerCycleSummary): string {
  return [
    `Cycle: ${summary.cycleType}`,
    `Status: ${summary.status}`,
    `Started: ${summary.startedAt}`,
    `Finished: ${summary.finishedAt}`,
    `DurationMs: ${summary.durationMs}`,
    `Succeeded: ${formatStepList(summary.steps, 'success')}`,
    `Failed: ${formatStepList(summary.steps, 'failure')}`,
  ].join('\n');
}

export function buildGenericWebhookPayload(summary: SchedulerCycleSummary) {
  return {
    event: 'scheduler_cycle' as const,
    cycleType: summary.cycleType,
    status: summary.status,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    durationMs: summary.durationMs,
    steps: summary.steps,
  };
}

async function postHealthchecks(summary: SchedulerCycleSummary) {
  const url = getHealthchecksUrl(summary);
  if (!url) {
    return;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: buildHealthchecksBody(summary),
  });

  if (!response.ok) {
    throw new Error(`Healthchecks returned ${response.status}`);
  }
}

async function postGenericWebhook(summary: SchedulerCycleSummary) {
  if (!config.notificationWebhookUrl) {
    return;
  }

  if (config.notificationWebhookMode === 'errors_only' && summary.status === 'success') {
    return;
  }

  const response = await fetch(config.notificationWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildGenericWebhookPayload(summary)),
  });

  if (!response.ok) {
    throw new Error(`Generic webhook returned ${response.status}`);
  }
}

export async function sendSchedulerNotifications(summary: SchedulerCycleSummary): Promise<void> {
  try {
    await postHealthchecks(summary);
  } catch (error) {
    log.warn('[Notifications] Healthchecks delivery failed:', error);
  }

  try {
    await postGenericWebhook(summary);
  } catch (error) {
    log.warn('[Notifications] Generic webhook delivery failed:', error);
  }
}
