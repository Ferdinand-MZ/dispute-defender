import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-lg border border-border bg-card p-6 text-center">
      <h2 className="text-lg font-semibold text-foreground">Page not found</h2>
      <p className="text-sm text-muted-foreground">The page you opened does not exist.</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Go to overview
      </Link>
    </div>
  );
}
