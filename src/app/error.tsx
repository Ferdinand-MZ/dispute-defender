"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[UI_ERROR]", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 rounded-lg border border-destructive/30 bg-card p-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-foreground">This page could not load</h2>
      <p className="text-sm text-muted-foreground">
        Something went wrong while reading the case data. Your disputes and PayPal state are unchanged.
      </p>
      {process.env.NODE_ENV === "development" && error.message && (
        <p className="rounded-md bg-muted px-3 py-2 text-left font-mono text-xs text-foreground [overflow-wrap:anywhere]">
          {error.message}
        </p>
      )}
      {error.digest && <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
