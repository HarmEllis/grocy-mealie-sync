'use client';

import { useState, useEffect } from 'react';

interface UnitOption {
  id: string;
  name: string;
  abbreviation: string;
  grocyUnitId: number;
  grocyUnitName: string;
}

interface SettingsData {
  defaultUnitMappingId: string | null;
  availableUnits: UnitOption[];
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  if (!settings) return null;
  if (settings.availableUnits.length === 0) {
    return <p style={{ color: '#666', fontSize: '0.9rem' }}>No units synced yet. Run a product sync first.</p>;
  }

  async function handleChange(value: string) {
    const newValue = value || null;
    setSaving(true);
    setMessage('');
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultUnitMappingId: newValue }),
      });
      setSettings(s => s ? { ...s, defaultUnitMappingId: newValue } : s);
      setMessage('Saved');
      setTimeout(() => setMessage(''), 2000);
    } catch {
      setMessage('Error saving');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label htmlFor="default-unit" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
        Default unit for new Grocy products
      </label>
      <select
        id="default-unit"
        value={settings.defaultUnitMappingId || ''}
        onChange={e => handleChange(e.target.value)}
        disabled={saving}
        style={{ padding: '0.5rem', fontSize: '1rem', minWidth: 200 }}
      >
        <option value="">-- Not set --</option>
        {[...settings.availableUnits].sort((a, b) => a.name.localeCompare(b.name)).map(u => (
          <option key={u.id} value={u.id}>
            {u.name}{u.abbreviation ? ` (${u.abbreviation})` : ''}
          </option>
        ))}
      </select>
      {message && <span style={{ marginLeft: '0.5rem', color: message === 'Saved' ? 'green' : 'red' }}>{message}</span>}
    </div>
  );
}
