import type { WizardTab } from '@/components/mapping-wizard/state';

export const ENSURE_LOW_STOCK_ENDPOINT = '/api/sync/grocy-to-mealie/ensure';

export interface SyncActionResponse {
  status?: 'ok' | 'partial' | 'skipped' | 'busy' | 'error';
  message?: string;
  error?: string;
  summary?: {
    processedProducts?: number;
    ensuredProducts?: number;
    unmappedProducts?: number;
    [key: string]: number | undefined;
  };
}

export interface PartialToastConfig {
  description?: string;
  duration?: number;
  mappingWizardTab?: WizardTab;
}

export function hasSyncActionError(responseOk: boolean, response: SyncActionResponse | null): boolean {
  return !responseOk || response?.status === 'error';
}

export function getPartialToastConfig(
  endpoint: string,
  response: SyncActionResponse | null,
): PartialToastConfig {
  const shouldPointToMappingWizard = endpoint === ENSURE_LOW_STOCK_ENDPOINT
    && (response?.summary?.unmappedProducts ?? 0) > 0;

  if (shouldPointToMappingWizard) {
    return {
      description: `${response?.message ?? 'Some low-stock products are not mapped yet.'} Open Mapping Wizard > Grocy Min Stock to map them.`,
      duration: 12000,
      mappingWizardTab: 'grocy-min-stock',
    };
  }

  return {
    description: response?.summary ? response.message : undefined,
  };
}
