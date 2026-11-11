import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getExecutionMode } from "@/lib/mode";
import { configuredModelId, isAiConfigured } from "@/lib/agent/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Verify PostgreSQL connection
    await db.execute(sql`SELECT 1`);

    return NextResponse.json(
      {
        status: "ok",
        app: "DisputeDefender",
        database: "postgresql",
        environment: "sandbox",
        mode: getExecutionMode(),
        aiModel: isAiConfigured() ? configuredModelId() : null,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
