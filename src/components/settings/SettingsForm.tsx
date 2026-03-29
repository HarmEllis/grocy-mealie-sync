'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { MIN_STOCK_STEP_LABELS, MIN_STOCK_STEP_VALUES, type MinStockStep } from '@/lib/min-stock-step';

interface UnitOption {
  id: string;
  name: string;
  abbreviation: string;
  grocyUnitId: number;
  grocyUnitName: string;
}

interface ShoppingListOption {
  id: string;
  name: string;
}

interface SettingLock {
  locked: boolean;
  envVar: string;
  envValue: string | null;
}

interface SettingsData {
  defaultUnitMappingId: string | null;
  mealieShoppingListId: string | null;
  autoCreateProducts: boolean;
  autoCreateUnits: boolean;
  ensureLowStockOnMealieList: boolean;
  syncMealieInPossession: boolean;
  mealieInPossessionOnlyAboveMinStock: boolean;
  mappingWizardMinStockStep: MinStockStep;
  stockOnlyMinStock: boolean;
  locks: {
    defaultUnitMappingId: SettingLock;
    mealieShoppingListId: SettingLock;
    autoCreateProducts: SettingLock;
    autoCreateUnits: SettingLock;
    ensureLowStockOnMealieList: SettingLock;
    syncMealieInPossession: SettingLock;
    mealieInPossessionOnlyAboveMinStock: SettingLock;
    mappingWizardMinStockStep: SettingLock;
    stockOnlyMinStock: SettingLock;
  };
  availableUnits: UnitOption[];
  availableShoppingLists: ShoppingListOption[];
}

async function saveSetting(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(payload?.error || 'Save failed');
    }
    toast.success('Setting updated');
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to save setting');
    return false;
  }
}

function LockBadge({ lock }: { lock: SettingLock }) {
  if (!lock.locked) {
    return null;
  }

  const valueSuffix = lock.envValue ? `=${lock.envValue}` : '';

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        aria-label={`Locked by ${lock.envVar}`}
      >
        Env
      </TooltipTrigger>
      <TooltipContent>
        {`This setting is controlled by ${lock.envVar}${valueSuffix}. Comment out ${lock.envVar} in your env file to edit it in the UI.`}
      </TooltipContent>
    </Tooltip>
  );
}

export function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setFetchLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load settings');
      setSettings(null);
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (fetchLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription className="flex items-center gap-3">
          {fetchError}
          <Button variant="outline" size="xs" onClick={loadSettings}>
            <RefreshCw className="size-3" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!settings) return null;

  async function handleShoppingListChange(value: string | null) {
    const newValue = value || null;
    const ok = await saveSetting({ mealieShoppingListId: newValue });
    if (ok) setSettings(s => s ? { ...s, mealieShoppingListId: newValue } : s);
  }

  async function handleUnitChange(value: string | null) {
    const newValue = value || null;
    const ok = await saveSetting({ defaultUnitMappingId: newValue });
    if (ok) setSettings(s => s ? { ...s, defaultUnitMappingId: newValue } : s);
  }

  async function handleAutoCreateChange(field: 'autoCreateProducts' | 'autoCreateUnits', value: boolean) {
    const ok = await saveSetting({ [field]: value });
    if (ok) setSettings(s => s ? { ...s, [field]: value } : s);
  }

  async function handleStockOnlyMinStockChange(value: boolean) {
    const ok = await saveSetting({ stockOnlyMinStock: value });
    if (ok) setSettings(s => s ? { ...s, stockOnlyMinStock: value } : s);
  }

  async function handleEnsureLowStockOnMealieListChange(value: boolean) {
    const ok = await saveSetting({ ensureLowStockOnMealieList: value });
    if (ok) setSettings(s => s ? { ...s, ensureLowStockOnMealieList: value } : s);
  }

  async function handleSyncMealieInPossessionChange(value: boolean) {
    const ok = await saveSetting({ syncMealieInPossession: value });
    if (ok) setSettings(s => s ? { ...s, syncMealieInPossession: value } : s);
  }

  async function handleMealieInPossessionOnlyAboveMinStockChange(value: boolean) {
    const ok = await saveSetting({ mealieInPossessionOnlyAboveMinStock: value });
    if (ok) setSettings(s => s ? { ...s, mealieInPossessionOnlyAboveMinStock: value } : s);
  }

  async function handleMappingWizardMinStockStepChange(value: MinStockStep) {
    const ok = await saveSetting({ mappingWizardMinStockStep: value });
    if (ok) setSettings(s => s ? { ...s, mappingWizardMinStockStep: value } : s);
  }

  const shoppingListOptions = [...settings.availableShoppingLists]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(list => ({ value: list.id, label: list.name }));

  const unitOptions = [...settings.availableUnits]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(unit => ({
      value: unit.id,
      label: `${unit.name}${unit.abbreviation ? ` (${unit.abbreviation})` : ''}`,
    }));

  const minStockStepOptions = MIN_STOCK_STEP_VALUES.map(step => ({
    value: step,
    label: MIN_STOCK_STEP_LABELS[step],
  }));

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="shopping-list" className="text-sm font-medium">
              Mealie shopping list
            </label>
            <LockBadge lock={settings.locks.mealieShoppingListId} />
          </div>
          {settings.availableShoppingLists.length === 0 ? (
            <p className="text-sm text-muted-foreground">Could not load shopping lists from Mealie.</p>
          ) : (
            <SearchableSelect
              options={shoppingListOptions}
              value={settings.mealieShoppingListId}
              onChange={value => { void handleShoppingListChange(value); }}
              disabled={settings.locks.mealieShoppingListId.locked}
              ariaLabel="Mealie shopping list"
              placeholder="Not set"
              searchPlaceholder="Search shopping lists..."
              className="ml-auto w-full max-w-xs"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="default-unit" className="text-sm font-medium">
              Default unit for new Grocy products
            </label>
            <LockBadge lock={settings.locks.defaultUnitMappingId} />
          </div>
          {settings.availableUnits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No units synced yet. Run a product sync first.</p>
          ) : (
            <SearchableSelect
              options={unitOptions}
              value={settings.defaultUnitMappingId}
              onChange={value => { void handleUnitChange(value); }}
              disabled={settings.locks.defaultUnitMappingId.locked}
              ariaLabel="Default unit for new Grocy products"
              placeholder="Not set"
              searchPlaceholder="Search units..."
              className="ml-auto w-full max-w-xs"
            />
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Grocy to Mealie</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control how Grocy stock is reflected in Mealie.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="sync-mealie-in-possession"
              checked={settings.syncMealieInPossession}
              disabled={settings.locks.syncMealieInPossession.locked}
              onCheckedChange={(checked: boolean) => handleSyncMealieInPossessionChange(checked)}
            />
            <label
              htmlFor="sync-mealie-in-possession"
              className={`text-sm ${settings.locks.syncMealieInPossession.locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
            >
              Sync Mealie &quot;In possession&quot; from Grocy stock
            </label>
            <LockBadge lock={settings.locks.syncMealieInPossession} />
          </div>
          <p className="pl-6 text-xs text-muted-foreground">
            When enabled, each Grocy poll compares mapped product stock with the last known desired possession state and only writes the differences back to Mealie.
          </p>
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="mealie-in-possession-only-above-min-stock"
              checked={settings.mealieInPossessionOnlyAboveMinStock}
              disabled={settings.locks.mealieInPossessionOnlyAboveMinStock.locked}
              onCheckedChange={(checked: boolean) => handleMealieInPossessionOnlyAboveMinStockChange(checked)}
            />
            <label
              htmlFor="mealie-in-possession-only-above-min-stock"
              className={`text-sm ${settings.locks.mealieInPossessionOnlyAboveMinStock.locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
            >
              Only set &quot;In possession&quot; above minimum stock
            </label>
            <LockBadge lock={settings.locks.mealieInPossessionOnlyAboveMinStock} />
          </div>
          <p className="pl-6 text-xs text-muted-foreground">
            When enabled, Mealie is only marked as in possession when the current Grocy stock is strictly greater than `min_stock_amount`. Otherwise, any stock above 0 counts as in possession.
          </p>
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="ensure-low-stock-on-mealie-list"
              checked={settings.ensureLowStockOnMealieList}
              disabled={settings.locks.ensureLowStockOnMealieList.locked}
              onCheckedChange={(checked: boolean) => handleEnsureLowStockOnMealieListChange(checked)}
            />
            <label
              htmlFor="ensure-low-stock-on-mealie-list"
              className={`text-sm ${settings.locks.ensureLowStockOnMealieList.locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
            >
              Actively ensure low-stock items stay on Mealie list
            </label>
            <LockBadge lock={settings.locks.ensureLowStockOnMealieList} />
          </div>
          <p className="pl-6 text-xs text-muted-foreground">
            When enabled, each Grocy poll checks whether every mapped below-minimum product still exists as an unchecked item on the selected Mealie shopping list, and recreates it if needed.
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Auto-create in Grocy</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, new Mealie items without a match are automatically created in Grocy during sync.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="auto-create-units"
              checked={settings.autoCreateUnits}
              disabled={settings.locks.autoCreateUnits.locked}
              onCheckedChange={(checked: boolean) => handleAutoCreateChange('autoCreateUnits', checked)}
            />
            <label
              htmlFor="auto-create-units"
              className={`text-sm ${settings.locks.autoCreateUnits.locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
            >
              Auto-create units
            </label>
            <LockBadge lock={settings.locks.autoCreateUnits} />
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="auto-create-products"
              checked={settings.autoCreateProducts}
              disabled={settings.locks.autoCreateProducts.locked}
              onCheckedChange={(checked: boolean) => handleAutoCreateChange('autoCreateProducts', checked)}
            />
            <label
              htmlFor="auto-create-products"
              className={`text-sm ${settings.locks.autoCreateProducts.locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
            >
              Auto-create products
            </label>
            <LockBadge lock={settings.locks.autoCreateProducts} />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Mapping Wizard</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control the step size used by the minimum stock number input in the mapped products overview.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="mapping-wizard-min-stock-step" className="text-sm font-medium">
                Min stock input step
              </label>
              <LockBadge lock={settings.locks.mappingWizardMinStockStep} />
            </div>
            <SearchableSelect
              options={minStockStepOptions}
              value={settings.mappingWizardMinStockStep}
              onChange={value => {
                if (value) {
                  void handleMappingWizardMinStockStepChange(value);
                }
              }}
              disabled={settings.locks.mappingWizardMinStockStep.locked}
              ariaLabel="Min stock input step"
              searchPlaceholder="Search step sizes..."
              className="ml-auto w-full max-w-xs"
              clearable={false}
            />
          </div>
          <p className="pl-6 text-xs text-muted-foreground">
            This only changes the browser stepper increment. Manually typed values like `0.1` are still accepted even when the step is `1`.
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Mealie to Grocy</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control how checked-off Mealie shopping list items are restocked in Grocy.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="stock-only-min-stock"
              checked={settings.stockOnlyMinStock}
              disabled={settings.locks.stockOnlyMinStock.locked}
              onCheckedChange={(checked: boolean) => handleStockOnlyMinStockChange(checked)}
            />
            <label
              htmlFor="stock-only-min-stock"
              className={`text-sm ${settings.locks.stockOnlyMinStock.locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
            >
              Only restock products with min stock
            </label>
            <LockBadge lock={settings.locks.stockOnlyMinStock} />
          </div>
          <p className="pl-6 text-xs text-muted-foreground">
            When enabled, checking off a Mealie item only adds stock in Grocy when the mapped product has `min_stock_amount &gt; 0`.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
