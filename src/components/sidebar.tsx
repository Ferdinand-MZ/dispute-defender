"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Cpu,
  FlaskConical,
  Inbox,
  LayoutDashboard,
  Menu,
  PackageCheck,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import {
  AI_MODEL_OPTIONS,
  AI_MODEL_STORAGE_KEY,
  OPERATOR_NAME_STORAGE_KEY,
  WORKSPACE_PREFS_EVENT,
} from "@/lib/ai-models";

const primaryNav = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Dispute queue", href: "/cases", icon: Inbox },
  { name: "Orders & shipments", href: "/demo-shop", icon: PackageCheck },
];

const testLabNav = [
  { name: "Dispute test lab", href: "/admin/simulate", icon: FlaskConical },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
      <BrandLogo />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold tracking-tight text-white">DisputeDefender</p>
        <p className="truncate text-[11px] font-medium text-navy-foreground/75">Merchant Resolution Hub</p>
      </div>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [labOpen, setLabOpen] = useState(() => pathname.startsWith("/admin/simulate"));

  useEffect(() => {
    if (pathname.startsWith("/admin/simulate")) {
      setLabOpen(true);
    }
  }, [pathname]);

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
            active ? "bg-white text-navy shadow-sm" : "text-navy-foreground hover:bg-navy-raised hover:text-white"
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {item.name}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col justify-between px-3 py-5">
      <div className="space-y-6">
        <div>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-foreground/60">
            Operations
          </p>
          <ul className="space-y-1">{primaryNav.map(renderLink)}</ul>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setLabOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-foreground/65 transition-colors hover:text-white"
          >
            <span>Diagnostics & Test Lab</span>
            {labOpen ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          {labOpen && <ul className="mt-1 space-y-1">{testLabNav.map(renderLink)}</ul>}
        </div>
      </div>
    </nav>
  );
}

function WorkspaceFooter() {
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [customModelInput, setCustomModelInput] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [operatorName, setOperatorName] = useState("Sarah Jenkins");

  useEffect(() => {
    const loadPrefs = () => {
      const savedModel = window.localStorage.getItem(AI_MODEL_STORAGE_KEY);
      if (savedModel) {
        const known = AI_MODEL_OPTIONS.some((m) => m.id === savedModel);
        if (known) {
          setSelectedModel(savedModel);
          setIsCustom(false);
        } else {
          setSelectedModel("__custom__");
          setCustomModelInput(savedModel);
          setIsCustom(true);
        }
      }
      const savedOperator = window.localStorage.getItem(OPERATOR_NAME_STORAGE_KEY);
      if (savedOperator) {
        setOperatorName(savedOperator);
      }
    };

    loadPrefs();
    window.addEventListener(WORKSPACE_PREFS_EVENT, loadPrefs);
    return () => window.removeEventListener(WORKSPACE_PREFS_EVENT, loadPrefs);
  }, []);

  function broadcastModel(modelId: string) {
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, modelId);
    window.dispatchEvent(new CustomEvent(WORKSPACE_PREFS_EVENT));
  }

  function handleSelectChange(val: string) {
    setSelectedModel(val);
    if (val === "__custom__") {
      setIsCustom(true);
      if (customModelInput.trim()) {
        broadcastModel(customModelInput.trim());
      }
    } else {
      setIsCustom(false);
      broadcastModel(val);
    }
  }

  function handleOperatorChange(val: string) {
    setOperatorName(val);
    window.localStorage.setItem(OPERATOR_NAME_STORAGE_KEY, val);
    window.dispatchEvent(new CustomEvent(WORKSPACE_PREFS_EVENT));
  }

  return (
    <div className="space-y-3 border-t border-white/10 px-4 py-4 text-xs">
      <div className="space-y-1.5">
        <label htmlFor="sidebar-ai-model" className="flex items-center gap-1.5 font-medium text-white/90">
          <Cpu className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
          AI Copilot Engine
        </label>
        <select
          id="sidebar-ai-model"
          value={selectedModel}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="h-8 w-full rounded-md border border-white/15 bg-navy-raised px-2 text-xs font-medium text-white focus:border-sky-400 focus:outline-none"
        >
          {AI_MODEL_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id} className="bg-navy text-white">
              {opt.label}
            </option>
          ))}
          <option value="__custom__" className="bg-navy text-white">
            Custom Model ID…
          </option>
        </select>
        {isCustom && (
          <input
            type="text"
            value={customModelInput}
            onChange={(e) => {
              setCustomModelInput(e.target.value);
              if (e.target.value.trim()) {
                broadcastModel(e.target.value.trim());
              }
            }}
            placeholder="e.g. gemini-2.5-flash-lite"
            className="h-7 w-full rounded-md border border-white/15 bg-navy-raised px-2 font-mono text-[11px] text-white placeholder:text-navy-foreground/50 focus:border-sky-400 focus:outline-none"
          />
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="sidebar-operator" className="flex items-center gap-1.5 font-medium text-white/90">
          <UserCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
          Active Operator
        </label>
        <input
          id="sidebar-operator"
          type="text"
          value={operatorName}
          onChange={(e) => handleOperatorChange(e.target.value)}
          placeholder="Merchant Representative"
          className="h-8 w-full rounded-md border border-white/15 bg-navy-raised px-2 text-xs text-white placeholder:text-navy-foreground/50 focus:border-sky-400 focus:outline-none"
        />
      </div>

      <div className="pt-1 text-[11px] leading-relaxed text-navy-foreground/75">
        <p className="font-medium text-white">Rina Dropship Store</p>
        <p className="mt-0.5">Grounded evidence workflow · Human sign-off required</p>
      </div>
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
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-navy lg:flex">
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>
        <NavList pathname={pathname} />
        <WorkspaceFooter />
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
            <WorkspaceFooter />
          </div>
        </div>
      )}
    </>
  );
}
