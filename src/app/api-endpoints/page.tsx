import { AppBadge, AppCard } from '@/components/redesign/primitives';
import { PageHeader } from '@/components/layout/PageHeader';
import { API_ENDPOINTS } from '@/lib/api-endpoints';

export const dynamic = 'force-dynamic';

export default function ApiEndpointsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="API Endpoints"
        subtitle="Available REST API routes for integrations and manual operations."
      />

      <AppCard className="overflow-hidden p-0">
        <div className="space-y-2 p-3 md:hidden">
          {API_ENDPOINTS.map(([method, path, description]) => (
            <div key={path} className="rounded-lg border border-border bg-bg-1 p-3">
              <div className="mb-2 flex items-center gap-2">
                <AppBadge
                  tone={method === 'GET' ? 'success' : 'accent'}
                  small
                  className="font-mono"
                >
                  {method}
                </AppBadge>
              </div>
              <p className="mb-2 break-all font-mono text-xs text-text-1">{path}</p>
              <p className="text-sm text-text-2">{description}</p>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
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
