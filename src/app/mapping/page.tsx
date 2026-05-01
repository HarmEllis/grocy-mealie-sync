import { MappingWizard } from '@/components/mapping-wizard/MappingWizard';
import type { WizardTab } from '@/components/mapping-wizard/state';
import { AppCard } from '@/components/redesign/primitives';
import { PageHeader } from '@/components/layout/PageHeader';
import { config } from '@/lib/config';

const WIZARD_TABS: WizardTab[] = ['units', 'products', 'grocy-min-stock', 'mapped-products', 'conflicts'];

function resolveTab(value: string | string[] | undefined): WizardTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && WIZARD_TABS.includes(candidate as WizardTab)) {
    return candidate as WizardTab;
  }

  return 'units';
}

export const dynamic = 'force-dynamic';

export default async function MappingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined> | undefined>;
}) {
  const resolvedParams = await searchParams;
  const initialTab = resolveTab(resolvedParams?.tab);

  return (
    <div className="flex min-h-full flex-col gap-5">
      <PageHeader
        title="Product Mapping"
        subtitle="Map Mealie items to existing Grocy items, or create new ones. Start with units, then products."
      />

      <AppCard className="flex min-h-[calc(100vh-220px)] flex-col overflow-hidden">
        <MappingWizard
          initialTab={initialTab}
          timeZone={config.timeZone}
          timeZoneLocale={config.timeZoneLocale}
        />
      </AppCard>
    </div>
  );
}
