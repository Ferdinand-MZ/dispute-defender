import { AdminSimulateClient } from "@/components/admin-simulate-client";
import { PageHeader } from "@/components/case-status";

export const dynamic = "force-dynamic";

export default function AdminSimulatePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulator"
        description="Open and settle PayPal Sandbox disputes to walk through the whole flow. Sandbox only, no real money."
      />
      <AdminSimulateClient />
    </div>
  );
}
