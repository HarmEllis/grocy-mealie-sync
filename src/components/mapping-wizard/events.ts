import type { WizardTab } from './state';

export const OPEN_MAPPING_WIZARD_EVENT = 'mapping-wizard:open';

interface OpenMappingWizardDetail {
  tab?: WizardTab;
}

export function openMappingWizard(detail: OpenMappingWizardDetail = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<OpenMappingWizardDetail>(OPEN_MAPPING_WIZARD_EVENT, { detail }));
}
