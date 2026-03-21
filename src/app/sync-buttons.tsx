'use client';

import { useState } from 'react';

const syncActions = [
  { label: 'Sync Products & Units', endpoint: '/api/sync/products' },
  { label: 'Grocy → Mealie', endpoint: '/api/sync/grocy-to-mealie' },
  { label: 'Mealie → Grocy', endpoint: '/api/sync/mealie-to-grocy' },
];

export default function SyncButtons() {
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function triggerSync(endpoint: string) {
    setRunning(endpoint);
    setMessage('');
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) throw new Error(`${res.status}`);
      setMessage('Done');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Error');
    } finally {
      setRunning(null);
    }
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {syncActions.map(action => (
        <button
          key={action.endpoint}
          onClick={() => triggerSync(action.endpoint)}
          disabled={running !== null}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running === action.endpoint ? 'Running...' : action.label}
        </button>
      ))}
      {message && (
        <span style={{ color: message === 'Done' ? 'green' : 'red' }}>{message}</span>
      )}
    </div>
  );
}
