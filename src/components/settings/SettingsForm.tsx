'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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

interface SettingsData {
  defaultUnitMappingId: string | null;
  mealieShoppingListId: string | null;
  autoCreateProducts: boolean;
  autoCreateUnits: boolean;
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
    if (!res.ok) throw new Error('Save failed');
    toast.success('Setting updated');
    return true;
  } catch {
    toast.error('Failed to save setting');
    return false;
  }
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="shopping-list" className="text-sm font-medium shrink-0">
          Mealie shopping list
        </label>
        {settings.availableShoppingLists.length === 0 ? (
          <p className="text-sm text-muted-foreground">Could not load shopping lists from Mealie.</p>
        ) : (
          <select
            id="shopping-list"
            value={settings.mealieShoppingListId || ''}
            onChange={e => handleShoppingListChange(e.target.value)}
            className="h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 ml-auto"
          >
            <option value="">-- Not set --</option>
            {[...settings.availableShoppingLists].sort((a, b) => a.name.localeCompare(b.name)).map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <label htmlFor="default-unit" className="text-sm font-medium shrink-0">
          Default unit for new Grocy products
        </label>
        {settings.availableUnits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No units synced yet. Run a product sync first.</p>
        ) : (
          <select
            id="default-unit"
            value={settings.defaultUnitMappingId || ''}
            onChange={e => handleUnitChange(e.target.value)}
            className="h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 ml-auto"
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
          <p className="text-sm font-medium">Auto-create in Grocy</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            When enabled, new Mealie items without a match are automatically created in Grocy during sync.
          </p>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox
            checked={settings.autoCreateUnits}
            onCheckedChange={(checked: boolean) => handleAutoCreateChange('autoCreateUnits', checked)}
          />
          <span className="text-sm">Auto-create units</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox
            checked={settings.autoCreateProducts}
            onCheckedChange={(checked: boolean) => handleAutoCreateChange('autoCreateProducts', checked)}
          />
          <span className="text-sm">Auto-create products</span>
        </label>
      </div>
    </div>
  );
}
