import { ShieldAlert } from "lucide-react";

export function SandboxBanner() {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs font-medium text-amber-900 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <span>
          <strong>PAYPAL SANDBOX MODE:</strong> Real money movement is disabled. All API operations hit <code className="bg-amber-100/80 px-1 py-0.5 rounded text-[11px]">api-m.sandbox.paypal.com</code>.
        </span>
      </div>
      <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-mono">
        Strict Grounding Active
      </span>
    </div>
  );
}
