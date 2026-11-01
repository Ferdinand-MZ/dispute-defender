import { FlaskConical } from "lucide-react";

// Navy-tinted rather than amber: amber is reserved for deadline urgency.
export function SandboxBanner() {
  return (
    <div className="border-b bg-secondary px-4 py-2 text-[13px] text-foreground sm:px-6 lg:px-8">
      <p className="flex items-start gap-2 sm:items-center">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-navy sm:mt-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">PayPal Sandbox.</strong> No real money moves.
          <span className="hidden text-muted-foreground sm:inline">
            {" "}
            Every call goes to <span className="font-mono text-xs">api-m.sandbox.paypal.com</span>.
          </span>
        </span>
      </p>
    </div>
  );
}
