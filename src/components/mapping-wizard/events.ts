import type { WizardTab } from './state';

export const OPEN_MAPPING_WIZARD_EVENT = 'mapping-wizard:open';

interface OpenMappingWizardDetail {
  tab?: WizardTab;
}

export function openMappingWizard(detail: OpenMappingWizardDetail = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams();
  if (detail.tab) {
    params.set('tab', detail.tab);
  }

  const query = params.toString();
  const target = query ? `/mapping?${query}` : '/mapping';
  window.location.assign(target);
}
