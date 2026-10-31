import { env } from "./env";

export type ExecutionMode = "demo" | "sandbox";

export class PayPalConfigError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = "PayPalConfigError";
    this.statusCode = 503;
  }
}

/**
 * Returns the server-controlled execution mode.
 * - 'demo': uses fixture data and simulated actions; NEVER calls external PayPal APIs.
 * - 'sandbox': communicates with real PayPal Sandbox API (https://api-m.sandbox.paypal.com).
 *
 * This mode is strictly server-controlled by environment variables (`DEMO_MODE`).
 * Browsers and client headers cannot override this setting.
 */
export function getExecutionMode(): ExecutionMode {
  return env.DEMO_MODE ? "demo" : "sandbox";
}

export function isDemoMode(): boolean {
  return getExecutionMode() === "demo";
}

export function isSandboxMode(): boolean {
  return getExecutionMode() === "sandbox";
}

/**
 * Asserts that PayPal Sandbox credentials are valid and present when running in sandbox mode.
 * If credentials are missing in sandbox mode, throws a clear configuration error.
 * NEVER silently falls back to demo mode.
 */
export function assertSandboxCredentials(): void {
  // Production PayPal endpoints are forbidden per AGENTS.md Rule 1
  if (env.PAYPAL_ENV !== "sandbox") {
    throw new PayPalConfigError(
      "SECURITY_VIOLATION: Non-negotiable Rule 1 strictly restricts PayPal integration to 'sandbox' environment."
    );
  }

  if (isSandboxMode()) {
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      throw new PayPalConfigError(
        "PAYPAL_CONFIGURATION_ERROR: Sandbox mode requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to be configured in .env."
      );
    }
  }
}

/**
 * Formats a consistent, auditable simulation response payload for demo mode actions.
 * Guarantees that simulated actions are visibly labeled and never reported as real PayPal successes.
 */
export function formatDemoSimulationResponse(actionType: string, detail?: Record<string, unknown>) {
  return {
    mode: "demo" as const,
    simulated: true,
    status: "SIMULATED_SUCCESS",
    label: "SIMULATION (Demo Mode)",
    actionType,
    notice: "This action was executed locally in Demo Mode. No live PayPal financial endpoints were contacted.",
    ...detail,
  };
}
