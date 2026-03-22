'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Shared hook for saving a single setting field via PUT /api/settings.
 * Returns { saving, message, save } where `save` sends the update
 * and shows a timed status message.
 */
export function useSaveSetting() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const save = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    setSaving(true);
    setMessage('');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      setMessage('Saved');
      timeoutRef.current = setTimeout(() => setMessage(''), 2000);
      return true;
    } catch {
      setMessage('Error saving');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { saving, message, save };
}
