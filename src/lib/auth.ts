import { NextRequest } from "next/server";
import { env } from "./env";

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: "merchant_admin" | "merchant_operator";
  merchantId: string;
}

export interface AuthResult {
  authenticated: boolean;
  user?: AuthenticatedUser;
  error?: string;
  status?: number;
}

const DEFAULT_MERCHANT_ID = "merch_default";
const DEFAULT_DEV_PASSWORD = "demo-merchant-admin";

/**
 * Extracts and verifies merchant authentication from the request.
 * Supports:
 *  1. HTTP Basic Authorization header (user:password)
 *  2. HTTP Bearer Authorization header (token)
 *  3. x-merchant-auth or x-merchant-password custom headers
 *  4. dd_session cookie
 */
export function verifyMerchantAuth(
  req: NextRequest,
  expectedDisputeMerchantId?: string
): AuthResult {
  // CSRF Check: Reject cross-site mutating requests
  const method = req.method.toUpperCase();
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (isMutating) {
    const secFetchSite = req.headers.get("sec-fetch-site");
    if (secFetchSite === "cross-site") {
      return {
        authenticated: false,
        error: "Cross-site request blocked: CSRF protection triggered",
        status: 403,
      };
    }

    // Fallback: If Sec-Fetch-Site is absent, inspect Origin header
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return {
            authenticated: false,
            error: "Cross-origin request blocked: CSRF origin mismatch",
            status: 403,
          };
        }
      } catch {
        return {
          authenticated: false,
          error: "Malformed origin header blocked",
          status: 403,
        };
      }
    }
  }

  // 1. Resolve configured valid password / key
  const validPassword = env.APP_PASSWORD && env.APP_PASSWORD.trim()
    ? env.APP_PASSWORD.trim()
    : DEFAULT_DEV_PASSWORD;

  let providedSecret: string | null = null;
  let username = "Merchant Admin";

  // Check Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "basic" && encoded) {
      try {
        const decoded = Buffer.from(encoded, "base64").toString("utf-8");
        const colonIdx = decoded.indexOf(":");
        if (colonIdx !== -1) {
          username = decoded.slice(0, colonIdx) || username;
          providedSecret = decoded.slice(colonIdx + 1);
        } else {
          providedSecret = decoded;
        }
      } catch {
        // malformed base64
      }
    } else if (scheme?.toLowerCase() === "bearer" && encoded) {
      providedSecret = encoded;
    }
  }

  // Check custom headers if not provided via standard Authorization
  if (!providedSecret) {
    providedSecret =
      req.headers.get("x-merchant-auth") ||
      req.headers.get("x-merchant-password");
  }

  // Check cookie
  if (!providedSecret) {
    const sessionCookie = req.cookies.get("dd_session")?.value;
    if (sessionCookie) {
      providedSecret = sessionCookie;
    }
  }

  // If no credentials supplied or secret does not match validPassword
  if (!providedSecret || providedSecret !== validPassword) {
    return {
      authenticated: false,
      error: "Authentication required: Invalid or missing merchant credentials.",
      status: 401,
    };
  }

  const user: AuthenticatedUser = {
    id: "user_merchant_1",
    name: username || "Merchant Representative",
    role: "merchant_admin",
    merchantId: DEFAULT_MERCHANT_ID,
  };

  // 2. Cross-Merchant Authorization Check
  // Check if caller supplied an explicit foreign merchant context
  const targetMerchantId = req.headers.get("x-merchant-id") || expectedDisputeMerchantId;
  if (targetMerchantId && targetMerchantId !== user.merchantId) {
    return {
      authenticated: false,
      error: "Access denied: Dispute does not belong to the authenticated merchant.",
      status: 403,
    };
  }

  return {
    authenticated: true,
    user,
  };
}

/**
 * Verifies that the request has administrative simulation privileges.
 */
export function verifyAdminAuth(req: NextRequest): AuthResult {
  const auth = verifyMerchantAuth(req);
  if (!auth.authenticated || !auth.user) {
    return auth;
  }

  if (auth.user.role !== "merchant_admin") {
    return {
      authenticated: false,
      error: "Access denied: Administrative privileges required.",
      status: 403,
    };
  }

  // In production, forbid simulation endpoints unless DEMO_MODE is active
  if (env.NODE_ENV === "production" && !env.DEMO_MODE) {
    return {
      authenticated: false,
      error: "Simulation endpoints are disabled in production live environment.",
      status: 403,
    };
  }

  return {
    authenticated: true,
    user: auth.user,
  };
}
