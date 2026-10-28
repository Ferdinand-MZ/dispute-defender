import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { env } from "../env";

/**
 * Returns read-only PayPal agent tools from @paypal/agent-toolkit for AI SDK.
 * Read-only actions: get_dispute, list_disputes, get_shipment_tracking.
 * Evidence submission and write operations are strictly gated through our REST client.
 */
export function getPayPalReadOnlyTools() {
  const clientId = env.PAYPAL_CLIENT_ID || "sandbox_client_id";
  const clientSecret = env.PAYPAL_CLIENT_SECRET || "sandbox_client_secret";

  const toolkit = new PayPalAgentToolkit({
    clientId,
    clientSecret,
    configuration: {
      actions: {
        disputes: {
          list: true,
          get: true,
        },
        shipment: {
          get: true,
        },
      },
      context: {
        sandbox: true,
      },
    },
  });

  return toolkit.getTools();
}
