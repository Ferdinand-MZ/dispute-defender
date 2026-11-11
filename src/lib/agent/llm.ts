import { z } from "zod";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "../env";
import { DEFAULT_AI_MODEL_ID } from "../ai-models";

export class AIProviderNotConfiguredError extends Error {
  constructor(message = "AI Provider is not configured with an API key") {
    super(message);
    this.name = "AIProviderNotConfiguredError";
  }
}

/**
 * Instantiate the configured AI model provider, optionally overriding the model ID per request.
 */
export function getAIModel(overrideModelId?: string) {
  if (!env.AI_API_KEY) {
    throw new AIProviderNotConfiguredError(
      `AI_API_KEY is not set. Please set AI_API_KEY in your environment or .env file.`
    );
  }

  // Only the Google provider package is installed; fail loudly instead of silently using Gemini.
  if (env.AI_PROVIDER !== "google") {
    throw new AIProviderNotConfiguredError(
      `AI_PROVIDER '${env.AI_PROVIDER}' is not installed. Use AI_PROVIDER=google or add the provider package.`
    );
  }

  const google = createGoogleGenerativeAI({
    apiKey: env.AI_API_KEY,
  });

  const cleaned = overrideModelId?.trim();
  const targetModel = cleaned && cleaned !== DEFAULT_AI_MODEL_ID ? cleaned : env.AI_MODEL;
  return google(targetModel);
}

/** True when an LLM can be called. Without it the agent falls back to rule-based text. */
export function isAiConfigured(): boolean {
  return Boolean(env.AI_API_KEY) && env.AI_PROVIDER === "google";
}

export function configuredModelId(): string {
  return env.AI_MODEL;
}

export interface GenerateStructuredOptions<T extends z.ZodTypeAny> {
  schema: T;
  system: string;
  prompt: string;
}

/** Injectable structured-output function, so agent steps can be tested without a network call. */
export type StructuredGenerator = <T extends z.ZodTypeAny>(
  options: GenerateStructuredOptions<T>
) => Promise<z.infer<T>>;

export interface AgentModel {
  id: string;
  generate: StructuredGenerator;
}

/**
 * The configured model (or user-selected overrideModelId), or null when no AI provider is set up
 * or when the user explicitly selects the deterministic `"rules"` engine.
 */
export function defaultAgentModel(overrideModelId?: string | null): AgentModel | null {
  const cleaned = overrideModelId?.trim();
  if (cleaned === "rules" || cleaned === "template") {
    return null;
  }
  if (!isAiConfigured()) {
    return null;
  }
  const modelId = cleaned && cleaned !== DEFAULT_AI_MODEL_ID ? cleaned : configuredModelId();
  return {
    id: modelId,
    generate: <T extends z.ZodTypeAny>(options: GenerateStructuredOptions<T>) =>
      generateStructured(options, modelId),
  };
}

/**
 * Generate structured, schema-validated JSON output from the LLM.
 * Calls in analysis and drafting have NO tool execution capabilities.
 */
export async function generateStructured<T extends z.ZodTypeAny>(
  {
    schema,
    system,
    prompt,
  }: GenerateStructuredOptions<T>,
  overrideModelId?: string
): Promise<z.infer<T>> {
  const model = getAIModel(overrideModelId);

  const response = await generateObject({
    model,
    schema,
    system,
    prompt,
    mode: "json",
  });

  return response.object;
}
