import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Verify SQLite connection
    db.run(sql`SELECT 1`);

    return NextResponse.json(
      {
        status: "ok",
        app: "DisputeDefender",
        environment: "sandbox",
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
