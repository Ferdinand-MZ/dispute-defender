"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  LayoutDashboard,
  Inbox,
  ShoppingBag,
  SlidersHorizontal,
  FileText,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Dispute Queue", href: "/cases", icon: Inbox },
  { name: "Demo Storefront", href: "/demo-shop", icon: ShoppingBag },
  { name: "Sandbox Simulator", href: "/admin/simulate", icon: SlidersHorizontal },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-2.5 px-6 border-b border-border">
        <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
            DisputeDefender
            <span className="text-[10px] uppercase font-semibold bg-primary/10 text-primary px-1.5 py-0.2 rounded">
              AI
            </span>
          </h1>
          <p className="text-[11px] text-muted-foreground">PayPal Merchant Copilot</p>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="rounded-md border border-border bg-background p-3 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-foreground">Rule Engine Active</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-normal">
            Every claim grounded in verified facts. Autonomous write ops blocked.
          </p>
        </div>
      </div>
    </aside>
  );
}
