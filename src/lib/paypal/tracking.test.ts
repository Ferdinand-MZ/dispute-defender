import { describe, it, expect, vi, beforeEach } from "vitest";
import { addTrackingBatch } from "./tracking";

const mockPayPalRequest = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({
  payPalRequest: mockPayPalRequest,
}));

describe("PayPal Tracking API (POST /v1/shipping/trackers-batch)", () => {
  beforeEach(() => {
    mockPayPalRequest.mockReset();
  });

  it("submits tracker payload to /v1/shipping/trackers-batch", async () => {
    mockPayPalRequest.mockResolvedValue({
      data: {
        tracker_identifiers: [
          {
            transaction_id: "CAP-1001-A1",
            tracking_number: "TESTTRACK0001",
            status: "SHIPPED",
          },
        ],
      },
    });

    const result = await addTrackingBatch({
      trackers: [
        {
          transaction_id: "CAP-1001-A1",
          tracking_number: "TESTTRACK0001",
          status: "SHIPPED",
          carrier: "FEDEX",
        },
      ],
    });

    expect(mockPayPalRequest).toHaveBeenCalledWith(
      "/v1/shipping/trackers-batch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          trackers: [
            {
              transaction_id: "CAP-1001-A1",
              tracking_number: "TESTTRACK0001",
              status: "SHIPPED",
              carrier: "FEDEX",
            },
          ],
        }),
      })
    );

    expect(result.tracker_identifiers).toHaveLength(1);
    expect(result.tracker_identifiers?.[0].status).toBe("SHIPPED");
  });

  it("throws if tracker items list is empty", async () => {
    await expect(addTrackingBatch({ trackers: [] })).rejects.toThrow(
      "At least one tracker item is required"
    );
  });
});
