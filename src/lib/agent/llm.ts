import { z } from "zod";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "../env";

export class AIProviderNotConfiguredError extends Error {
  constructor(message = "AI Provider is not configured with an API key") {
    super(message);
    this.name = "AIProviderNotConfiguredError";
  }
}

/**
 * Instantiate the configured AI model provider.
 */
export function getAIModel() {
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

  return google(env.AI_MODEL);
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

/** The configured model, or null when no AI provider is set up. */
export function defaultAgentModel(): AgentModel | null {
  return isAiConfigured() ? { id: configuredModelId(), generate: generateStructured } : null;
}

/**
 * Generate structured, schema-validated JSON output from the LLM.
 * Calls in analysis and drafting have NO tool execution capabilities.
 */
export async function generateStructured<T extends z.ZodTypeAny>({
  schema,
  system,
  prompt,
}: GenerateStructuredOptions<T>): Promise<z.infer<T>> {
  const model = getAIModel();

  const response = await generateObject({
    model,
    schema,
    system,
    prompt,
    mode: "json",
  });

  return response.object;
}
