import { PageHeader } from '@/components/layout/PageHeader';
import { ShoppingDashboard } from '@/components/shop/ShoppingDashboard';

export const dynamic = 'force-dynamic';

export default function ShoppingPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Shopping"
        subtitle="Shared retailer lists, receipts and everything that needs your decision."
      />
      <ShoppingDashboard />
    </div>
  );
}
