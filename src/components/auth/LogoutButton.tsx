'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';

export function LogoutButton() {
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    setSubmitting(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout} disabled={submitting}>
      {submitting ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      {submitting ? 'Signing out...' : 'Logout'}
    </Button>
  );
}
