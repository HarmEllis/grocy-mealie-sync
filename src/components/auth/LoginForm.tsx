'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, LockKeyhole } from 'lucide-react';

export function LoginForm() {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || `Login failed (${response.status})`);
        return;
      }

      window.location.href = '/';
    } catch {
      setError('Network request failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor="auth-secret" className="text-sm font-medium">
          Authentication secret
        </label>
        <Input
          id="auth-secret"
          type="password"
          value={secret}
          onChange={event => setSecret(event.target.value)}
          autoFocus
          autoComplete="current-password"
          placeholder="Enter AUTH_SECRET"
          disabled={submitting}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting || secret.trim() === ''}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
        {submitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
