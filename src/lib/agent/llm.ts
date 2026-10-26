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

  // Default to Google Generative AI (Gemini) as specified
  const google = createGoogleGenerativeAI({
    apiKey: env.AI_API_KEY,
  });

  return google(env.AI_MODEL || "gemini-1.5-flash");
}

export interface GenerateStructuredOptions<T extends z.ZodTypeAny> {
  schema: T;
  system: string;
  prompt: string;
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
