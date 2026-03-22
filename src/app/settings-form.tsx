'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSaveSetting } from './use-save-setting';

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

export default function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);

  const unitSave = useSaveSetting();
  const listSave = useSaveSetting();
  const autoCreateSave = useSaveSetting();

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
    return <p style={{ color: '#666', fontSize: '0.9rem' }}>Loading settings...</p>;
  }

  if (fetchError) {
    return (
      <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', borderRadius: 6, color: '#991b1b', fontSize: '0.9rem' }}>
        <p style={{ margin: '0 0 0.5rem' }}>{fetchError}</p>
        <button
          onClick={loadSettings}
          style={{
            padding: '0.4rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer',
            background: '#fff', border: '1px solid #d1d5db', borderRadius: 4,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!settings) return null;

  async function handleUnitChange(value: string) {
    const newValue = value || null;
    const ok = await unitSave.save({ defaultUnitMappingId: newValue });
    if (ok) setSettings(s => s ? { ...s, defaultUnitMappingId: newValue } : s);
  }

  async function handleShoppingListChange(value: string) {
    const newValue = value || null;
    const ok = await listSave.save({ mealieShoppingListId: newValue });
    if (ok) setSettings(s => s ? { ...s, mealieShoppingListId: newValue } : s);
  }

  async function handleAutoCreateChange(field: 'autoCreateProducts' | 'autoCreateUnits', value: boolean) {
    const ok = await autoCreateSave.save({ [field]: value });
    if (ok) setSettings(s => s ? { ...s, [field]: value } : s);
  }

  function statusSpan(message: string) {
    if (!message) return null;
    const isSuccess = message === 'Saved';
    return (
      <span
        className={`status-message ${isSuccess ? 'status-message--success' : 'status-message--error'}`}
        style={{ display: 'inline', padding: '0.15rem 0.5rem', marginLeft: '0.5rem' }}
      >
        {isSuccess ? 'setting updated' : message}
      </span>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="shopping-list" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
          Mealie shopping list
        </label>
        {settings.availableShoppingLists.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Could not load shopping lists from Mealie.</p>
        ) : (
          <>
            <select
              id="shopping-list"
              value={settings.mealieShoppingListId || ''}
              onChange={e => handleShoppingListChange(e.target.value)}
              disabled={listSave.saving}
              style={{ padding: '0.5rem', fontSize: '1rem', minWidth: 200 }}
            >
              <option value="">-- Not set --</option>
              {[...settings.availableShoppingLists].sort((a, b) => a.name.localeCompare(b.name)).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            {statusSpan(listSave.message)}
          </>
        )}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="default-unit" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
          Default unit for new Grocy products
        </label>
        {settings.availableUnits.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.9rem' }}>No units synced yet. Run a product sync first.</p>
        ) : (
          <>
            <select
              id="default-unit"
              value={settings.defaultUnitMappingId || ''}
              onChange={e => handleUnitChange(e.target.value)}
              disabled={unitSave.saving}
              style={{ padding: '0.5rem', fontSize: '1rem', minWidth: 200 }}
            >
              <option value="">-- Not set --</option>
              {[...settings.availableUnits].sort((a, b) => a.name.localeCompare(b.name)).map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}{u.abbreviation ? ` (${u.abbreviation})` : ''}
                </option>
              ))}
            </select>
            {statusSpan(unitSave.message)}
          </>
        )}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Auto-create in Grocy
        </label>
        <p style={{ color: '#666', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
          When enabled, new Mealie items without a match are automatically created in Grocy during sync.
          Use the Mapping Wizard first to map existing items, then enable these.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.autoCreateUnits}
            onChange={e => handleAutoCreateChange('autoCreateUnits', e.target.checked)}
            disabled={autoCreateSave.saving}
          />
          <span style={{ fontSize: '0.9rem' }}>Auto-create units</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.autoCreateProducts}
            onChange={e => handleAutoCreateChange('autoCreateProducts', e.target.checked)}
            disabled={autoCreateSave.saving}
          />
          <span style={{ fontSize: '0.9rem' }}>Auto-create products</span>
        </label>
        {statusSpan(autoCreateSave.message)}
      </div>
    </div>
  );
}
