import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PAYPAL_ENV: z.literal("sandbox").default("sandbox"),
  PAYPAL_CLIENT_ID: z.string().optional().default(""),
  PAYPAL_CLIENT_SECRET: z.string().optional().default(""),
  PAYPAL_WEBHOOK_ID: z.string().optional().default(""),
  PAYPAL_BUYER_PAYER_ID: z.string().optional().default(""),
  AI_PROVIDER: z.enum(["google", "anthropic", "openai"]).default("google"),
  AI_MODEL: z.string().default("gemini-1.5-flash"),
  AI_API_KEY: z.string().optional().default(""),
  DATABASE_URL: z.string().default("file:./data/app.db"),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  APP_PASSWORD: z.string().optional().default(""),
  CRON_SECRET: z.string().default("dev-cron-secret"),
  DEMO_MODE: z
    .string()
    .optional()
    .default("true")
    .transform((val) => val === "true" || val === "1"),
  DISPUTE_FEE: z
    .string()
    .optional()
    .default("0.00")
    .transform((val) => parseFloat(val) || 0),
  EFFORT_COST: z
    .string()
    .optional()
    .default("5.00")
    .transform((val) => parseFloat(val) || 5.0),
  AUTOPILOT: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val === "true"),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    throw new Error(
      `Invalid environment variables: ${result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
    );
  }
  return result.data;
}

export const env = getEnv();
