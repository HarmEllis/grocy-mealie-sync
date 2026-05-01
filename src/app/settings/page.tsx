import { SettingsForm } from '@/components/settings/SettingsForm';
import { SyncRecoveryControls } from '@/components/sync/SyncRecoveryControls';
import { AppCardSection } from '@/components/redesign/primitives';
import { PageHeader } from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Sync behaviour and defaults." />

      <AppCardSection
        title="Configuration"
        subtitle="Update sync defaults, mapping behaviour, and cleanup policies."
      >
        <SettingsForm />
      </AppCardSection>

      <AppCardSection
        title="Lock Recovery"
        subtitle="Clear stale scheduler state after a crash when startup is blocked by old locks."
      >
        <SyncRecoveryControls />
      </AppCardSection>
    </div>
  );
}
