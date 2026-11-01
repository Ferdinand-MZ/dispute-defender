"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutDashboard, Menu, ShieldCheck, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNav = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Dispute queue", href: "/cases", icon: Inbox },
];

const sandboxNav = [
  { name: "Demo store", href: "/demo-shop", icon: ShoppingBag },
  { name: "Simulator", href: "/admin/simulate", icon: SlidersHorizontal },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
        <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">DisputeDefender</span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const renderLink = (item: (typeof primaryNav)[number]) => {
    const active = isActive(pathname, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
            active ? "bg-white text-navy" : "text-navy-foreground hover:bg-navy-raised hover:text-white"
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {item.name}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-6 px-3 py-5">
      <ul className="space-y-1">{primaryNav.map(renderLink)}</ul>
      <div>
        <p className="px-3 pb-2 text-xs font-medium text-navy-foreground/70">Sandbox tools</p>
        <ul className="space-y-1">{sandboxNav.map(renderLink)}</ul>
      </div>
    </nav>
  );
}

function StoreFooter() {
  return (
    <div className="border-t border-white/10 px-5 py-4 text-sm">
      <p className="font-medium text-white">Rina Dropship Store</p>
      <p className="mt-0.5 text-xs text-navy-foreground/80">PayPal Sandbox merchant</p>
      <p className="mt-3 text-xs leading-relaxed text-navy-foreground/80">
        The AI drafts. You approve. Nothing reaches PayPal without your sign-off.
      </p>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close the drawer whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const toggle = toggleRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [open]);

  return (
    <>
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-navy lg:flex">
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>
        <NavList pathname={pathname} />
        <StoreFooter />
      </aside>

      {/* Mobile and tablet top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-navy px-2 pl-4 lg:hidden">
        <Brand />
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-navy-raised"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Open menu</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-navy/50" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            id="mobile-nav"
            ref={drawerRef}
            className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-navy shadow-[8px_0_32px_-8px_hsl(var(--navy)/0.5)]"
          >
            <div className="flex h-14 items-center justify-between px-2 pl-4">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-navy-raised"
              >
                <X className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Close menu</span>
              </button>
            </div>
            <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
            <StoreFooter />
          </div>
        </div>
      )}
    </>
  );
}
