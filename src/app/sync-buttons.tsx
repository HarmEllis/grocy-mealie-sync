'use client';

import { useState, useRef, useEffect } from 'react';

const syncActions = [
  { label: 'Sync Products & Units', endpoint: '/api/sync/products' },
  { label: 'Grocy \u2192 Mealie', endpoint: '/api/sync/grocy-to-mealie' },
  { label: 'Mealie \u2192 Grocy', endpoint: '/api/sync/mealie-to-grocy' },
];

export default function SyncButtons() {
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount (L5)
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function triggerSync(endpoint: string) {
    setRunning(endpoint);
    setMessage('');
    setIsError(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        // Parse error body for a meaningful message (L1)
        let errorMsg = `${res.status}`;
        try {
          const body = await res.json();
          if (body.error) errorMsg = body.error;
          else if (body.message) errorMsg = body.message;
        } catch {
          // response body wasn't JSON, use status code
        }
        setIsError(true);
        setMessage(errorMsg);
        return;
      }
      setIsError(false);
      setMessage('sync completed');
      timeoutRef.current = setTimeout(() => setMessage(''), 3000);
    } catch {
      setIsError(true);
      setMessage('network request failed');
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
        <span
          className={`status-message ${isError ? 'status-message--error' : 'status-message--success'}`}
          style={{ display: 'inline', padding: '0.15rem 0.5rem' }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
