'use client';

import { useState, useEffect } from 'react';

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
  const [savingUnit, setSavingUnit] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [savingAutoCreate, setSavingAutoCreate] = useState(false);
  const [unitMessage, setUnitMessage] = useState('');
  const [listMessage, setListMessage] = useState('');
  const [autoCreateMessage, setAutoCreateMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  if (!settings) return null;

  async function handleUnitChange(value: string) {
    const newValue = value || null;
    setSavingUnit(true);
    setUnitMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultUnitMappingId: newValue }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSettings(s => s ? { ...s, defaultUnitMappingId: newValue } : s);
      setUnitMessage('Saved');
      setTimeout(() => setUnitMessage(''), 2000);
    } catch {
      setUnitMessage('Error saving');
    } finally {
      setSavingUnit(false);
    }
  }

  async function handleShoppingListChange(value: string) {
    const newValue = value || null;
    setSavingList(true);
    setListMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealieShoppingListId: newValue }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSettings(s => s ? { ...s, mealieShoppingListId: newValue } : s);
      setListMessage('Saved');
      setTimeout(() => setListMessage(''), 2000);
    } catch {
      setListMessage('Error saving');
    } finally {
      setSavingList(false);
    }
  }

  async function handleAutoCreateChange(field: 'autoCreateProducts' | 'autoCreateUnits', value: boolean) {
    setSavingAutoCreate(true);
    setAutoCreateMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSettings(s => s ? { ...s, [field]: value } : s);
      setAutoCreateMessage('Saved');
      setTimeout(() => setAutoCreateMessage(''), 2000);
    } catch {
      setAutoCreateMessage('Error saving');
    } finally {
      setSavingAutoCreate(false);
    }
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
              disabled={savingList}
              style={{ padding: '0.5rem', fontSize: '1rem', minWidth: 200 }}
            >
              <option value="">-- Not set --</option>
              {[...settings.availableShoppingLists].sort((a, b) => a.name.localeCompare(b.name)).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            {listMessage && <span style={{ marginLeft: '0.5rem', color: listMessage === 'Saved' ? 'green' : 'red' }}>{listMessage}</span>}
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
              disabled={savingUnit}
              style={{ padding: '0.5rem', fontSize: '1rem', minWidth: 200 }}
            >
              <option value="">-- Not set --</option>
              {[...settings.availableUnits].sort((a, b) => a.name.localeCompare(b.name)).map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}{u.abbreviation ? ` (${u.abbreviation})` : ''}
                </option>
              ))}
            </select>
            {unitMessage && <span style={{ marginLeft: '0.5rem', color: unitMessage === 'Saved' ? 'green' : 'red' }}>{unitMessage}</span>}
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
            disabled={savingAutoCreate}
          />
          <span style={{ fontSize: '0.9rem' }}>Auto-create units</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.autoCreateProducts}
            onChange={e => handleAutoCreateChange('autoCreateProducts', e.target.checked)}
            disabled={savingAutoCreate}
          />
          <span style={{ fontSize: '0.9rem' }}>Auto-create products</span>
        </label>
        {autoCreateMessage && <span style={{ fontSize: '0.85rem', color: autoCreateMessage === 'Saved' ? 'green' : 'red' }}>{autoCreateMessage}</span>}
      </div>
    </div>
  );
}
