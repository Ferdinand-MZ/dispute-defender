import { AdminSimulateClient } from "@/components/admin-simulate-client";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminSimulatePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-primary" />
            Sandbox Dispute Simulator
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Exercise full PayPal dispute lifecycle loops in the Sandbox environment without live risk.
          </p>
        </div>
        <Badge variant="warning" className="font-mono text-xs">
          SANDBOX SIMULATION ONLY
        </Badge>
      </div>

      <AdminSimulateClient />
    </div>
  );
}
