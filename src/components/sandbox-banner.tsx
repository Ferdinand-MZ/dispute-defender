"use client";

import { useEffect, useState } from "react";
import { Cpu, Database, ShieldCheck } from "lucide-react";
import {
  AI_MODEL_OPTIONS,
  AI_MODEL_STORAGE_KEY,
  DEFAULT_AI_MODEL_ID,
  WORKSPACE_PREFS_EVENT,
} from "@/lib/ai-models";

type DbStatus = "checking" | "ok" | "down";

interface Health {
  db: DbStatus;
  mode: "demo" | "sandbox" | null;
  aiModel: string | null;
}

const HEALTH_POLL_MS = 30_000;

export function SandboxBanner() {
  const [activeModel, setActiveModel] = useState(DEFAULT_AI_MODEL_ID);
  const [health, setHealth] = useState<Health>({ db: "checking", mode: null, aiModel: null });

  useEffect(() => {
    const syncPrefs = () => {
      const saved = window.localStorage.getItem(AI_MODEL_STORAGE_KEY);
      if (saved) setActiveModel(saved);
    };
    syncPrefs();
    window.addEventListener(WORKSPACE_PREFS_EVENT, syncPrefs);
    return () => window.removeEventListener(WORKSPACE_PREFS_EVENT, syncPrefs);
  }, []);

  // The status shown here is read from /api/health, never assumed.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = (await res.json()) as { status?: string; mode?: string; aiModel?: string | null };
        if (cancelled) return;
        setHealth({
          db: res.ok && body.status === "ok" ? "ok" : "down",
          mode: body.mode === "demo" || body.mode === "sandbox" ? body.mode : null,
          aiModel: typeof body.aiModel === "string" ? body.aiModel : null,
        });
      } catch {
        if (!cancelled) setHealth((prev) => ({ ...prev, db: "down" }));
      }
    };
    check();
    const timer = window.setInterval(check, HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const knownOption = AI_MODEL_OPTIONS.some((m) => m.id === activeModel);

  function handleQuickModelChange(val: string) {
    setActiveModel(val);
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, val);
    window.dispatchEvent(new CustomEvent(WORKSPACE_PREFS_EVENT));
  }

  function optionLabel(id: string, label: string, badge: string) {
    if (id !== DEFAULT_AI_MODEL_ID) return `${label} (${badge})`;
    return health.aiModel ? `${label} (${health.aiModel})` : label;
  }

  return (
    <div className="border-b bg-secondary/70 px-4 py-2 text-[13px] text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>PayPal Disputes API</span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
              Sandbox
            </span>
            {health.mode === "demo" && (
              <span
                className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-800"
                title="Demo mode: seeded data, PayPal actions are simulated locally"
              >
                Demo data
              </span>
            )}
          </span>
          <span
            role="status"
            className={
              health.db === "down"
                ? "inline-flex items-center gap-1.5 text-xs font-medium text-destructive"
                : "hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex"
            }
          >
            <Database
              className={
                health.db === "ok"
                  ? "h-3.5 w-3.5 text-emerald-600"
                  : health.db === "down"
                    ? "h-3.5 w-3.5 text-destructive"
                    : "h-3.5 w-3.5 text-muted-foreground"
              }
              aria-hidden="true"
            />
            {health.db === "ok" && "Database connected"}
            {health.db === "checking" && "Checking database…"}
            {health.db === "down" && "Database unreachable"}
          </span>
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 text-xs sm:w-auto">
          <Cpu className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <label htmlFor="topbar-ai-select" className="shrink-0 whitespace-nowrap text-muted-foreground">
            AI model
          </label>
          <select
            id="topbar-ai-select"
            value={activeModel}
            onChange={(e) => handleQuickModelChange(e.target.value)}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none sm:flex-none"
          >
            {AI_MODEL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {optionLabel(opt.id, opt.label, opt.badge)}
              </option>
            ))}
            {!knownOption && <option value={activeModel}>Custom: {activeModel}</option>}
          </select>
        </div>
      </div>
    </div>
  );
}
