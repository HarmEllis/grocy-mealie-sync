'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Loader2, Plug, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AppBadge, AppInput, AppStatusDot, AppToggle } from '@/components/redesign/primitives';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PluginAuthDialog } from './PluginAuthDialog';
import { apiJson } from './api';
import type { InstallationView } from '@/lib/shop/overview';

interface IssuedToken {
  installationId: string;
  name: string;
  token: string;
}

function composeSnippet(token: string): string {
  return [
    'services:',
    '  shop-plugin:',
    '    image: <shop plugin image>',
    '    restart: unless-stopped',
    '    environment:',
    '      # Internal Docker network URL of grocy-mealie-sync; no port is published for the plugin.',
    '      GM_SYNC_URL: http://grocy-mealie-sync:3000',
    `      GM_SYNC_PLUGIN_TOKEN: ${token}`,
    '      PLUGIN_DATA_DIR: /data',
    '    volumes:',
    '      # Retailer sign-in tokens stay in this volume and never reach grocy-mealie-sync.',
    '      - shop-plugin-data:/data',
    '',
    'volumes:',
    '  shop-plugin-data:',
  ].join('\n');
}

function formatTime(value: string | null): string {
  if (!value) return 'never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleString();
}

export function ShopPluginsPanel() {
  const [installations, setInstallations] = useState<InstallationView[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'revoke' | 'rotate' | 'reset'; installation: InstallationView } | null>(null);
  const [authFor, setAuthFor] = useState<InstallationView | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ installations?: InstallationView[] }>('/api/plugins/installations');
      setInstallations(Array.isArray(data?.installations) ? data.installations : []);
    } catch (error) {
      toast.error('Could not load shop plugins', { description: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 15_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function create() {
    setBusy('create');
    try {
      const data = await apiJson<{ installation: { id: string; name: string }; token: string }>('/api/plugins/installations', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setIssued({ installationId: data.installation.id, name: data.installation.name, token: data.token });
      setName('');
      await load();
    } catch (error) {
      toast.error('Could not create the plugin installation', { description: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function updateSettings(installation: InstallationView, settings: Record<string, unknown>) {
    setBusy(installation.id);
    try {
      await apiJson(`/api/plugins/installations/${installation.id}`, { method: 'PATCH', body: JSON.stringify({ settings }) });
      await load();
    } catch (error) {
      toast.error('Could not save the setting', { description: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function runConfirmed() {
    if (!confirm) return;
    const { kind, installation } = confirm;
    setBusy(installation.id);
    try {
      if (kind === 'revoke') {
        await apiJson(`/api/plugins/installations/${installation.id}`, { method: 'DELETE' });
        toast.success('Plugin token revoked');
      } else if (kind === 'rotate') {
        const data = await apiJson<{ token: string }>(`/api/plugins/installations/${installation.id}/rotate`, { method: 'POST' });
        setIssued({ installationId: installation.id, name: installation.name, token: data.token });
      } else {
        await apiJson(`/api/plugins/installations/${installation.id}/reset-binding`, { method: 'POST' });
        toast.success('Account and list binding reset');
      }
      setConfirm(null);
      await load();
    } catch (error) {
      toast.error('Action failed', { description: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed; select the text manually');
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Shop plugins run in their own containers without a web UI or published port. They connect to this app over a
        WebSocket on the same address and port. Each installation has its own token; retailer sign-in data stays inside the plugin.
        {' '}Disabling receipt processing or revoking a token stops new receipt plans; existing plans finish, and uncertain writes wait for review.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <AppInput
          aria-label="Plugin installation name"
          placeholder="Name, for example Albert Heijn"
          value={name}
          maxLength={80}
          onChange={event => setName(event.target.value)}
          className="w-64"
        />
        <Button size="sm" onClick={create} disabled={!name.trim() || busy === 'create'}>
          {busy === 'create' ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
          Add plugin
        </Button>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {issued ? (
        <div className="space-y-2 rounded-lg border border-[var(--badge-warning-text)]/40 p-3" role="status">
          <p className="text-sm font-semibold">Token for {issued.name}: copy it now, it is shown only once.</p>
          <div className="flex items-center gap-2">
            <code className="block flex-1 break-all rounded bg-bg-3/60 p-2 text-xs" data-testid="plugin-token">{issued.token}</code>
            <Button size="sm" variant="outline" onClick={() => copy(issued.token)}><Copy className="size-4" /> Copy</Button>
          </div>
          <p className="text-xs text-muted-foreground">Docker Compose example (adjust the image and service names):</p>
          <pre className="overflow-x-auto rounded bg-bg-3/60 p-2 text-xs">{composeSnippet(issued.token)}</pre>
          <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>I stored the token</Button>
        </div>
      ) : null}

      {installations === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : installations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No shop plugins yet. Without plugins, nothing changes in the regular sync.</p>
      ) : (
        <ul className="space-y-3">
          {installations.map(installation => (
            <li key={installation.id} className="space-y-3 rounded-lg border border-border p-3" data-testid="plugin-installation">
              <div className="flex flex-wrap items-center gap-2">
                <AppStatusDot status={installation.connected ? 'success' : 'idle'} pulse={installation.connected} />
                <span className="font-semibold">{installation.name}</span>
                <AppBadge small tone={installation.connected ? 'success' : 'default'}>{installation.connected ? 'connected' : 'offline'}</AppBadge>
                {installation.providerLabel ? <AppBadge small>{installation.providerLabel}</AppBadge> : null}
                {installation.authState ? (
                  <AppBadge small tone={installation.authState === 'authenticated' ? 'success' : 'warning'}>{installation.authState}</AppBadge>
                ) : null}
                <span className="text-xs text-muted-foreground">token …{installation.tokenHint}</span>
              </div>
              <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div>Plugin: {installation.pluginName ? `${installation.pluginName} ${installation.pluginVersion ?? ''}` : 'not connected yet'}</div>
                <div>Account: {installation.accountLabel ?? 'not signed in'}</div>
                <div>Capabilities: {installation.capabilities.length ? installation.capabilities.join(', ') : 'unknown'}</div>
                <div>Last seen: {formatTime(installation.lastSeenAt)}</div>
                {installation.receiptCursor ? (
                  <div>Last receipt pull: {formatTime(installation.receiptCursor.lastPullAt)}{installation.receiptCursor.lastError ? ` (error: ${installation.receiptCursor.lastError})` : ''}</div>
                ) : null}
                {installation.settings.receiptsActivatedAt ? (
                  <div>Receipts processed from: {formatTime(installation.settings.receiptsActivatedAt)}</div>
                ) : null}
              </dl>
              <div className="flex flex-wrap gap-4">
                <AppToggle
                  label="Sync shared shopping list"
                  checked={installation.settings.listSyncEnabled}
                  disabled={busy === installation.id}
                  onChange={next => updateSettings(installation, { listSyncEnabled: next })}
                />
                <AppToggle
                  label="Process receipts"
                  checked={installation.settings.receiptsEnabled}
                  disabled={busy === installation.id}
                  onChange={next => updateSettings(installation, { receiptsEnabled: next })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted-foreground" htmlFor={`location-${installation.id}`}>Grocy store ID for receipt bookings</label>
                <AppInput
                  id={`location-${installation.id}`}
                  className="w-24"
                  inputMode="numeric"
                  defaultValue={installation.settings.grocyShoppingLocationId ?? ''}
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    const parsed = value ? Number(value) : null;
                    if (parsed !== null && (!Number.isInteger(parsed) || parsed <= 0)) {
                      toast.error('Enter a positive Grocy store ID or leave it empty');
                      return;
                    }
                    if (parsed !== installation.settings.grocyShoppingLocationId) void updateSettings(installation, { grocyShoppingLocationId: parsed });
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!installation.connected || !installation.capabilities.includes('auth')} onClick={() => setAuthFor(installation)}>
                  <KeyRound className="size-4" /> Retailer sign-in
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: 'rotate', installation })}>
                  <RotateCcw className="size-4" /> Rotate token
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: 'reset', installation })}>
                  Reset account and list binding
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirm({ kind: 'revoke', installation })}>
                  <Trash2 className="size-4" /> Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmed}
        running={confirm !== null && busy === confirm.installation.id}
        title={confirm?.kind === 'revoke' ? 'Revoke this plugin token?' : confirm?.kind === 'rotate' ? 'Rotate this plugin token?' : 'Reset the account and list binding?'}
        description={confirm?.kind === 'revoke'
          ? 'The plugin is disconnected immediately and cannot reconnect with this token.'
          : confirm?.kind === 'rotate'
            ? 'A new token is shown once. The plugin must be restarted with the new token.'
            : 'Use this only after the plugin was signed in to another account or list on purpose. List ownership is forgotten; stored receipts are kept and never booked again.'}
      />

      {authFor ? <PluginAuthDialog installation={authFor} onClose={() => { setAuthFor(null); void load(); }} /> : null}
    </div>
  );
}
