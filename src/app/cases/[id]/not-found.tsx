import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function CaseNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-lg border border-border bg-card p-6 text-center">
      <h2 className="text-lg font-semibold text-foreground">Dispute not found</h2>
      <p className="text-sm text-muted-foreground">
        No case with this ID is stored yet. It may not have arrived from PayPal, or the demo data was reset.
      </p>
      <Link href="/cases" className={buttonVariants({ variant: "outline" })}>
        Back to the queue
      </Link>
    </div>
  );
}
