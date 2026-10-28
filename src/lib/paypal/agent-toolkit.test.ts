import { describe, it, expect } from "vitest";
import { getPayPalReadOnlyTools } from "./agent-toolkit";

describe("PayPal Agent Toolkit (Read-Only Tools)", () => {
  it("provides read-only dispute and tracking tools from @paypal/agent-toolkit", () => {
    const tools = getPayPalReadOnlyTools();
    const toolNames = Object.keys(tools);

    expect(toolNames).toContain("get_dispute");
    expect(toolNames).toContain("list_disputes");
    expect(toolNames).toContain("get_shipment_tracking");

    // Strictly ensure no write or destructive tools are exposed
    expect(toolNames).not.toContain("accept_dispute_claim");
    expect(toolNames).not.toContain("create_refund");
    expect(toolNames).not.toContain("pay_order");
  });
});
