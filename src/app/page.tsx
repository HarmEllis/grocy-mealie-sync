import { getSyncState } from '@/lib/sync/state';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { count } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { SyncButtons } from '@/components/sync/SyncButtons';
import { SyncRecoveryControls } from '@/components/sync/SyncRecoveryControls';
import { MappingWizard } from '@/components/mapping-wizard/MappingWizard';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { ArrowLeftRight, Settings, Wand2, Activity, Database, Clock, Terminal, AlertTriangle } from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';
import { getAuthConfig } from '@/lib/auth';

interface SyncStatus {
  lastGrocyPoll: string | Date | null;
  lastMealiePoll: string | Date | null;
  grocyBelowMinStockCount: number;
  mealieTrackedItemsCount: number;
  productMappings: number;
  unitMappings: number;
}

async function getStatus(): Promise<SyncStatus | null> {
  try {
    const state = await getSyncState();
    const [productCount] = await db.select({ count: count() }).from(productMappings);
    const [unitCount] = await db.select({ count: count() }).from(unitMappings);

    return {
      lastGrocyPoll: state.lastGrocyPoll,
      lastMealiePoll: state.lastMealiePoll,
      grocyBelowMinStockCount: Object.keys(state.grocyBelowMinStock).length,
      mealieTrackedItemsCount: Object.keys(state.mealieCheckedItems).length,
      productMappings: productCount.count,
      unitMappings: unitCount.count,
    };
  } catch {
    return null;
  }
}

function formatTimestamp(ts: string | Date | null): string {
  if (!ts) return 'Never';
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

export const dynamic = 'force-dynamic';

export default async function Home() {
  const status = await getStatus();
  const authEnabled = getAuthConfig().enabled;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <ArrowLeftRight className="size-5 text-primary" />
          <div>
            <h1 className="text-base font-semibold leading-tight">Grocy-Mealie Sync</h1>
            <p className="text-xs text-muted-foreground">Bi-directional sync between Grocy and Mealie</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {status && (
              <>
                <Badge variant="secondary" className="gap-1">
                  <Database className="size-3" />
                  {status.productMappings} products
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  {status.unitMappings} units
                </Badge>
              </>
            )}
            <ThemeSwitcher />
            {authEnabled ? <LogoutButton /> : null}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              Status
            </CardTitle>
            <CardDescription>Current sync state overview</CardDescription>
          </CardHeader>
          <CardContent>
            {status ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="size-3" />
                    Last Grocy poll
                  </p>
                  <p className="font-medium">{formatTimestamp(status.lastGrocyPoll)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="size-3" />
                    Last Mealie poll
                  </p>
                  <p className="font-medium">{formatTimestamp(status.lastMealiePoll)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Grocy below min stock</p>
                  <p className="font-medium">{status.grocyBelowMinStockCount} items</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Mealie tracked items</p>
                  <p className="font-medium">{status.mealieTrackedItemsCount} items</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Could not fetch status. The sync service may not be running.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-4" />
              Settings
            </CardTitle>
            <CardDescription>Configure sync behavior and defaults</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm />
          </CardContent>
        </Card>

        {/* Mapping Wizard Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="size-4" />
              Mapping Wizard
            </CardTitle>
            <CardDescription>Map Mealie items to Grocy products and units</CardDescription>
          </CardHeader>
          <CardContent>
            <MappingWizard />
          </CardContent>
        </Card>

        {/* Manual Sync Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="size-4" />
              Manual Sync
            </CardTitle>
            <CardDescription>Trigger sync operations manually</CardDescription>
          </CardHeader>
          <CardContent>
            <SyncButtons />
          </CardContent>
        </Card>

        {/* Recovery Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Lock Recovery
            </CardTitle>
            <CardDescription>Clear stale scheduler locks after a crash</CardDescription>
          </CardHeader>
          <CardContent>
            <SyncRecoveryControls />
          </CardContent>
        </Card>

        {/* API Endpoints Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="size-4" />
              API Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              {[
                ['GET', '/api/health', 'Health check'],
                ['GET', '/api/status', 'Sync status'],
                ['GET', '/api/mappings/products', 'Product mappings'],
                ['GET', '/api/mappings/units', 'Unit mappings'],
                ['POST', '/api/sync/products', 'Trigger product sync'],
                ['POST', '/api/sync/grocy-to-mealie', 'Trigger Grocy\u2192Mealie check'],
                ['POST', '/api/sync/grocy-to-mealie/ensure', 'Ensure below-min items exist on Mealie list'],
                ['POST', '/api/sync/grocy-to-mealie/in-possession', 'Fully reconcile Mealie "In possession" from Grocy stock'],
                ['POST', '/api/sync/mealie-to-grocy', 'Trigger Mealie\u2192Grocy check'],
                ['POST', '/api/sync/unlock', 'Clear persisted scheduler and sync locks'],
              ].map(([method, path, desc]) => (
                <div key={path} className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] w-12 justify-center">
                    {method}
                  </Badge>
                  <code className="text-xs text-foreground">{path}</code>
                  <Separator orientation="vertical" className="h-3" />
                  <span className="text-muted-foreground text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
