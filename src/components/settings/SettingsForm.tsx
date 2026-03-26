'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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
  stockOnlyMinStock: boolean;
  locks: {
    defaultUnitMappingId: SettingLock;
    mealieShoppingListId: SettingLock;
    autoCreateProducts: SettingLock;
    autoCreateUnits: SettingLock;
    ensureLowStockOnMealieList: SettingLock;
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
      <TooltipTrigger>
        <button
          type="button"
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          aria-label={`Locked by ${lock.envVar}`}
        >
          Env
        </button>
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

  async function handleShoppingListChange(value: string) {
    const newValue = value || null;
    const ok = await saveSetting({ mealieShoppingListId: newValue });
    if (ok) setSettings(s => s ? { ...s, mealieShoppingListId: newValue } : s);
  }

  async function handleUnitChange(value: string) {
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
            <select
              id="shopping-list"
              value={settings.mealieShoppingListId || ''}
              onChange={e => handleShoppingListChange(e.target.value)}
              disabled={settings.locks.mealieShoppingListId.locked}
              className="h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 ml-auto disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">-- Not set --</option>
              {[...settings.availableShoppingLists].sort((a, b) => a.name.localeCompare(b.name)).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
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
            <select
              id="default-unit"
              value={settings.defaultUnitMappingId || ''}
              onChange={e => handleUnitChange(e.target.value)}
              disabled={settings.locks.defaultUnitMappingId.locked}
              className="h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 ml-auto disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">-- Not set --</option>
              {[...settings.availableUnits].sort((a, b) => a.name.localeCompare(b.name)).map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}{u.abbreviation ? ` (${u.abbreviation})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Grocy to Mealie</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control how below-minimum Grocy products are kept present on the Mealie shopping list.
            </p>
          </div>
          <label className={`flex items-center gap-2.5 ${settings.locks.ensureLowStockOnMealieList.locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
            <Checkbox
              checked={settings.ensureLowStockOnMealieList}
              disabled={settings.locks.ensureLowStockOnMealieList.locked}
              onCheckedChange={(checked: boolean) => handleEnsureLowStockOnMealieListChange(checked)}
            />
            <span className="text-sm">Actively ensure low-stock items stay on Mealie list</span>
            <LockBadge lock={settings.locks.ensureLowStockOnMealieList} />
          </label>
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
          <label className={`flex items-center gap-2.5 ${settings.locks.autoCreateUnits.locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
            <Checkbox
              checked={settings.autoCreateUnits}
              disabled={settings.locks.autoCreateUnits.locked}
              onCheckedChange={(checked: boolean) => handleAutoCreateChange('autoCreateUnits', checked)}
            />
            <span className="text-sm">Auto-create units</span>
            <LockBadge lock={settings.locks.autoCreateUnits} />
          </label>
          <label className={`flex items-center gap-2.5 ${settings.locks.autoCreateProducts.locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
            <Checkbox
              checked={settings.autoCreateProducts}
              disabled={settings.locks.autoCreateProducts.locked}
              onCheckedChange={(checked: boolean) => handleAutoCreateChange('autoCreateProducts', checked)}
            />
            <span className="text-sm">Auto-create products</span>
            <LockBadge lock={settings.locks.autoCreateProducts} />
          </label>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Mealie to Grocy</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control how checked-off Mealie shopping list items are restocked in Grocy.
            </p>
          </div>
          <label className={`flex items-center gap-2.5 ${settings.locks.stockOnlyMinStock.locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
            <Checkbox
              checked={settings.stockOnlyMinStock}
              disabled={settings.locks.stockOnlyMinStock.locked}
              onCheckedChange={(checked: boolean) => handleStockOnlyMinStockChange(checked)}
            />
            <span className="text-sm">Only restock products with min stock</span>
            <LockBadge lock={settings.locks.stockOnlyMinStock} />
          </label>
          <p className="pl-6 text-xs text-muted-foreground">
            When enabled, checking off a Mealie item only adds stock in Grocy when the mapped product has `min_stock_amount &gt; 0`.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
