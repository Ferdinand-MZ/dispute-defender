import { env } from "../env";
import { PayPalErrorResponse } from "./types";

export const PAYPAL_SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix timestamp in ms
}

let cachedToken: TokenCache | null = null;

export function clearPayPalTokenCache(): void {
  cachedToken = null;
}

export class PayPalApiError extends Error {
  public status: number;
  public debugId?: string;
  public details?: unknown;

  constructor(status: number, message: string, debugId?: string, details?: unknown) {
    super(`PayPal API Error (${status}): ${message}${debugId ? ` [Debug-ID: ${debugId}]` : ""}`);
    this.name = "PayPalApiError";
    this.status = status;
    this.debugId = debugId;
    this.details = details;
  }
}

/**
 * Fetch OAuth 2.0 Client Credentials token with in-memory caching and expiry skew.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now();
  // Return cached token if valid for at least another 60 seconds
  if (cachedToken && cachedToken.expiresAt > now + 60 * 1000) {
    return cachedToken.accessToken;
  }

  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error(
      "Missing PayPal sandbox credentials. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env."
    );
  }

  const authHeader = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${PAYPAL_SANDBOX_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const debugId = response.headers.get("paypal-debug-id") || undefined;

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as PayPalErrorResponse;
    const errorMsg = errorBody.name && errorBody.message
      ? `${errorBody.name}: ${errorBody.message}`
      : (errorBody.message || errorBody.name || "Failed to obtain PayPal OAuth token");

    throw new PayPalApiError(
      response.status,
      errorMsg,
      debugId,
      errorBody
    );
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

export interface RequestOptions extends RequestInit {
  requestId?: string;
  maxRetries?: number;
}

/**
 * Robust fetch wrapper with OAuth injection, PayPal-Request-Id, retry on 429/5xx, and debug ID logging.
 */
export async function payPalRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<{ data: T; debugId?: string; status: number }> {
  const token = await getPayPalAccessToken();
  const url = endpoint.startsWith("http") ? endpoint : `${PAYPAL_SANDBOX_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (options.requestId) {
    headers["PayPal-Request-Id"] = options.requestId;
  }

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const maxRetries = options.maxRetries ?? 2;
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        ...options,
        headers,
      });

      const debugId = res.headers.get("paypal-debug-id") || undefined;

      if (!res.ok) {
        // Retry on 429 (Rate Limit) or 5xx server errors
        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
          continue;
        }

        const errorBody = (await res.json().catch(() => ({}))) as PayPalErrorResponse;
        const errorMsg = errorBody.name && errorBody.message
          ? `${errorBody.name}: ${errorBody.message}`
          : (errorBody.message || errorBody.name || `Request to ${endpoint} failed with HTTP ${res.status}`);

        throw new PayPalApiError(
          res.status,
          errorMsg,
          debugId,
          errorBody
        );
      }

      // Handle 204 No Content
      if (res.status === 204) {
        return { data: null as unknown as T, debugId, status: res.status };
      }

      const data = (await res.json()) as T;
      return { data, debugId, status: res.status };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && !(err instanceof PayPalApiError && err.status < 500 && err.status !== 429)) {
        const delay = Math.pow(2, attempt) * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        continue;
      }
      break;
    }
  }

  throw lastError;
}

/**
 * Safe, read-only connectivity check. Validates credentials and endpoint reachability.
 */
export async function checkPayPalConnectivity(): Promise<{
  connected: boolean;
  message: string;
  debugId?: string;
}> {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    return {
      connected: false,
      message: "PayPal sandbox credentials not configured in .env",
    };
  }

  try {
    const token = await getPayPalAccessToken();
    return {
      connected: !!token,
      message: "Connected to PayPal Sandbox API successfully",
    };
  } catch (err) {
    if (err instanceof PayPalApiError) {
      return {
        connected: false,
        message: err.message,
        debugId: err.debugId,
      };
    }
    return {
      connected: false,
      message: (err as Error).message || "Unknown connectivity failure",
    };
  }
}
