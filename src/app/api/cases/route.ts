import { NextResponse } from "next/server";
import { listCaseRows } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const disputeList = await listCaseRows();

    return NextResponse.json({ cases: disputeList });
  } catch (err) {
    console.error("[CASES_API_ERROR] Failed to list cases:", err);
    return NextResponse.json({ error: "Could not load the case queue" }, { status: 500 });
  }
}
