"use client";

import { Bell, HelpCircle, Shield, Store } from "lucide-react";
import { Badge } from "./ui/badge";

export function Header() {
  return (
    <header className="h-16 border-b border-border bg-card px-8 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Rina Dropship Store</span>
        </div>
        <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground bg-muted/40">
          Sandbox Merchant
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/20 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span>Grounding Validator: <strong className="text-foreground">Enforced</strong></span>
        </div>

        <button className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell className="h-4 w-4" />
        </button>

        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
          RD
        </div>
      </div>
    </header>
  );
}
