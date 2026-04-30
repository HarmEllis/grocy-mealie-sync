import { AppBadge, AppCard } from '@/components/redesign/primitives';
import { API_ENDPOINTS } from '@/lib/api-endpoints';

export const dynamic = 'force-dynamic';

export default function ApiEndpointsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text-1">API Endpoints</h1>
        <p className="mt-1 text-sm text-text-2">Available REST API routes for integrations and manual operations.</p>
      </div>

      <AppCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-bg-2">
              <tr>
                {['Method', 'Path', 'Description'].map(header => (
                  <th key={header} className="px-4 py-2 text-left text-[11px] font-bold tracking-[0.04em] text-text-3 uppercase">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {API_ENDPOINTS.map(([method, path, description]) => (
                <tr key={path} className="border-t border-border hover:bg-bg-2/70">
                  <td className="px-4 py-2">
                    <AppBadge
                      tone={method === 'GET' ? 'success' : 'accent'}
                      small
                      className="font-mono"
                    >
                      {method}
                    </AppBadge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-text-1">{path}</td>
                  <td className="px-4 py-2 text-text-2">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>
    </div>
  );
}
