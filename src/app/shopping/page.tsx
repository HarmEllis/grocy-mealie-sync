import { PageHeader } from '@/components/layout/PageHeader';
import { ShoppingDashboard } from '@/components/shop/ShoppingDashboard';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default function ShoppingPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Shopping"
        subtitle="Shared retailer lists, receipts and everything that needs your decision."
      />
      <ShoppingDashboard timeZone={config.timeZone} locale={config.timeZoneLocale} />
    </div>
  );
}
