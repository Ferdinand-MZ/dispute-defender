import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, facts, orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPayPalReadOnlyTools } from "@/lib/paypal/agent-toolkit";
import { getAIModel } from "@/lib/agent/llm";
import { generateText } from "ai";
import { env } from "@/lib/env";
import { z } from "zod";

const AskSchema = z.object({
  question: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const disputeId = params.id;

  try {
    const body = await req.json();
    const { question } = AskSchema.parse(body);

    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const dispute = disputeRows[0];
    const caseFacts = await db.select().from(facts).where(eq(facts.disputeId, disputeId));
    const linkedOrder = dispute.orderId
      ? (await db.select().from(orders).where(eq(orders.id, dispute.orderId)))[0]
      : null;

    // Check if AI API is configured
    if (!env.AI_API_KEY) {
      // Fallback response based on known dispute facts
      const factsSummary = caseFacts.map((f) => `• [${f.kind}] ${f.label}: ${f.value}`).join("\n");
      const orderSummary = linkedOrder
        ? `Order ${linkedOrder.id}: Status ${linkedOrder.status}, Carrier: ${linkedOrder.carrier || "none"}, Tracking: ${linkedOrder.trackingNumber || "none"}`
        : "No linked order.";

      return NextResponse.json({
        answer: `Case ${disputeId} is currently in state '${dispute.caseState}' for reason ${dispute.reason}. Disputed amount: ${dispute.amountMinor / 100} ${dispute.currency}.\n\nKnown Facts:\n${factsSummary}\n\n${orderSummary}\n\n(AI_API_KEY is not configured; answering from local database fact base.)`,
        toolsUsed: ["database_fact_base"],
      });
    }

    const model = getAIModel();
    const readTools = getPayPalReadOnlyTools();

    const systemPrompt = `You are DisputeDefender's read-only investigative AI assistant for PayPal merchants.
You have read-only tools from @paypal/agent-toolkit: list_disputes, get_dispute, and get_shipment_tracking.
You must never attempt or propose write actions or payments.
Current case in focus: Dispute ID: ${disputeId}, Reason: ${dispute.reason}, Status: ${dispute.paypalStatus}, Amount: ${dispute.amountMinor / 100} ${dispute.currency}.
Available facts in database:
${caseFacts.map((f) => `[${f.id}] ${f.label}: ${f.value} (untrusted=${f.untrusted})`).join("\n")}
Answer the merchant's question factually, concisely, and cite evidence.`;

    const { text, steps } = await generateText({
      model,
      tools: readTools,
      maxSteps: 3,
      system: systemPrompt,
      prompt: question,
    });

    const toolsUsed: string[] = [];
    if (steps) {
      for (const step of steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            toolsUsed.push(tc.toolName);
          }
        }
      }
    }

    return NextResponse.json({
      answer: text,
      toolsUsed,
    });
  } catch (err) {
    console.error("[ASK_CASE_ERROR]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
