import { SettingsForm } from '@/components/settings/SettingsForm';
import { SyncRecoveryControls } from '@/components/sync/SyncRecoveryControls';
import { AppCardSection } from '@/components/redesign/primitives';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text-1">Settings</h1>
        <p className="mt-1 text-sm text-text-2">Sync behaviour and defaults.</p>
      </div>

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
