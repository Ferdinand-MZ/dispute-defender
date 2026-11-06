"use client";

import { useEffect, useState } from "react";
import { Cpu, Database, ShieldCheck } from "lucide-react";
import {
  AI_MODEL_OPTIONS,
  AI_MODEL_STORAGE_KEY,
  WORKSPACE_PREFS_EVENT,
} from "@/lib/ai-models";

export function SandboxBanner() {
  const [activeModel, setActiveModel] = useState("gemini-2.5-flash");

  useEffect(() => {
    const syncPrefs = () => {
      const saved = window.localStorage.getItem(AI_MODEL_STORAGE_KEY);
      if (saved) setActiveModel(saved);
    };
    syncPrefs();
    window.addEventListener(WORKSPACE_PREFS_EVENT, syncPrefs);
    return () => window.removeEventListener(WORKSPACE_PREFS_EVENT, syncPrefs);
  }, []);

  const knownOption = AI_MODEL_OPTIONS.find((m) => m.id === activeModel);

  function handleQuickModelChange(val: string) {
    setActiveModel(val);
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, val);
    window.dispatchEvent(new CustomEvent(WORKSPACE_PREFS_EVENT));
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
          </span>
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
            <Database className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            PostgreSQL Connected
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Cpu className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <label htmlFor="topbar-ai-select" className="text-muted-foreground">
            AI Model:
          </label>
          <select
            id="topbar-ai-select"
            value={knownOption ? activeModel : activeModel}
            onChange={(e) => handleQuickModelChange(e.target.value)}
            className="h-7 rounded-md border border-input bg-card px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
          >
            {AI_MODEL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({opt.badge})
              </option>
            ))}
            {!knownOption && <option value={activeModel}>Custom: {activeModel}</option>}
          </select>
        </div>
      </div>
    </div>
  );
}
