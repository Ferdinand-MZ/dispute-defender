export interface AiModelOption {
  id: string;
  label: string;
  badge: string;
  description: string;
}

/** Sentinel: no per-request override, the server uses its configured `AI_MODEL`. */
export const DEFAULT_AI_MODEL_ID = "default";

export const AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    id: DEFAULT_AI_MODEL_ID,
    label: "Server default",
    badge: "AI_MODEL",
    description: "The model configured on the server through AI_MODEL",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    badge: "Fast",
    description: "Fast, grounded drafting & analysis with low latency",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    badge: "Reasoning",
    description: "Deep reasoning for complex multi-fact dispute narratives",
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    badge: "High Quota",
    description: "Reliable high-throughput model for rapid batch testing",
  },
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    badge: "Preview",
    description: "Next-generation preview model",
  },
  {
    id: "rules",
    label: "Rule-Based Engine (No LLM)",
    badge: "Deterministic",
    description: "100% deterministic template restating verified facts only",
  },
];

export const AI_MODEL_STORAGE_KEY = "dd_selected_ai_model";
export const OPERATOR_NAME_STORAGE_KEY = "dd_operator_name";
export const WORKSPACE_PREFS_EVENT = "dd:workspace-prefs-changed";
