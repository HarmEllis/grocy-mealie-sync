'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AppInput } from '@/components/redesign/primitives';
import { apiJson, ShopRequestError } from './api';
import type { AuthStep } from '@/lib/plugins/protocol/v1';

function safeHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Renders the declarative sign-in steps a plugin describes. Plugin text is
 * shown as plain text, only https links are opened, and entered values are
 * sent once and cleared; nothing is stored in the browser or in gm-sync.
 */
export function PluginAuthDialog({ installation, onClose }: { installation: { id: string; name: string }; onClose: () => void }) {
  const [step, setStep] = useState<AuthStep | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; guidance: string } | null>(null);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const data = await apiJson<{ step: AuthStep }>(`/api/plugins/installations/${installation.id}/auth`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setStep(data.step);
    } catch (caught) {
      const unavailable = caught instanceof ShopRequestError && (caught.code === 'NOT_CONNECTED' || caught.status === 503);
      const incompatible = caught instanceof ShopRequestError && ['UPSTREAM_CHANGED', 'BAD_RESPONSE', 'NOT_SUPPORTED'].includes(caught.code ?? '');
      setError({
        message: caught instanceof Error ? caught.message : 'The sign-in request failed.',
        guidance: unavailable
          ? 'The plugin is unavailable. Check that its container is running and connected, then start a new sign-in.'
          : incompatible
            ? 'The plugin could not complete this sign-in step. Check for a plugin update before trying a new sign-in.'
            : 'Start a new sign-in and follow the steps again. A login code may already have been used; do not submit the same code again.',
      });
      // A failed relay may have consumed a single-use code. Begin a fresh flow;
      // never leave a stale form available for another submission.
      setStep(null);
    } finally {
      setValues({});
      setBusy(false);
    }
  }

  useEffect(() => {
    void call({ action: 'begin' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const url = safeHttpsUrl(step?.url);
  const missingRequired = (step?.fields ?? []).some(field => field.required && !values[field.name]?.trim());

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto break-words">
        <DialogHeader>
          <DialogTitle>{step?.title ?? `Sign in for ${installation.name}`}</DialogTitle>
          <DialogDescription>{step?.message ?? 'Follow the steps provided by the shop plugin.'}</DialogDescription>
        </DialogHeader>

        {busy && !step ? <Loader2 className="size-5 animate-spin" /> : null}
        {error ? (
          <div className="space-y-2 rounded-md border border-[var(--badge-error-text)]/40 p-3 text-sm" role="alert">
            <p className="font-semibold text-[var(--badge-error-text)]">Sign-in failed</p>
            <p className="break-words">{error.message}</p>
            <p className="text-muted-foreground">{error.guidance}</p>
          </div>
        ) : null}

        {url ? (
          <a className="inline-flex items-center gap-1 text-sm underline" href={url} target="_blank" rel="noopener noreferrer">
            Open sign-in page <ExternalLink className="size-3" />
          </a>
        ) : null}

        {step && (step.kind === 'form' || step.kind === 'link') && step.fields?.length ? (
          <form
            className="space-y-3"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              void call({ action: 'submit', stepId: step.stepId, values });
            }}
          >
            {step.fields.map(field => (
              <label key={field.name} className="block space-y-1 text-sm">
                <span>{field.label}{field.required ? ' *' : ''}</span>
                <AppInput
                  type={field.secret || field.type === 'password' ? 'password' : field.type === 'email' ? 'email' : 'text'}
                  autoComplete="off"
                  value={values[field.name] ?? ''}
                  onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}
                />
              </label>
            ))}
            <Button type="submit" size="sm" disabled={busy || missingRequired}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Continue
            </Button>
          </form>
        ) : null}

        <DialogFooter>
          {error ? <Button size="sm" disabled={busy} onClick={() => void call({ action: 'begin' })}>Start a new sign-in</Button> : null}
          {step?.kind === 'done' ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void call({ action: 'logout' })}>Sign out</Button>
          ) : null}
          <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
