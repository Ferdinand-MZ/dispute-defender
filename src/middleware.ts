import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword || !appPassword.trim()) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // Webhooks, cron jobs, and health check must never be blocked by UI basic auth
  if (
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "basic" && encoded) {
      try {
        const decoded = Buffer.from(encoded, "base64").toString("utf-8");
        const colonIdx = decoded.indexOf(":");
        const pass = colonIdx !== -1 ? decoded.slice(colonIdx + 1) : decoded;
        if (pass === appPassword) {
          return NextResponse.next();
        }
      } catch {
        // Fall through to 401
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="DisputeDefender Sandbox Protected"',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.svg
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
