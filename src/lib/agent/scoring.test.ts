import { describe, it, expect } from "vitest";
import { calculateStrengthScore, WIN_BANDS } from "./scoring";

describe("Evidence Strength Scoring", () => {
  it("scores Scenario S1 (Not Received, Strong Evidence) high", () => {
    const s1Facts = {
      hasTracking: true,
      hasDelivered: true,
      addressMatch: true,
      hasShippingPolicy: true,
      hasComms: true,
    };

    const result = calculateStrengthScore(
      "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      s1Facts
    );

    expect(result.score).toBe(1.0);
    expect(result.scorePercent).toBe(100);
    expect(result.pWinBand).toBe("high");
    expect(result.pWin).toBe(WIN_BANDS.high.pWin);
  });

  it("scores Scenario S2 (Not Received, Weak Evidence) low", () => {
    const s2Facts = {
      hasTracking: true,
      hasDelivered: false,
      addressMatch: true,
      hasShippingPolicy: false,
      hasComms: false,
    };

    const result = calculateStrengthScore(
      "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      s2Facts
    );

    // 0.35 (tracking) + 0.15 (address) = 0.50 -> medium band
    expect(result.score).toBe(0.5);
    expect(result.pWinBand).toBe("low");
  });

  it("handles missing tracking completely", () => {
    const noTrackingFacts = {
      hasTracking: false,
      hasDelivered: false,
      addressMatch: false,
      hasShippingPolicy: false,
      hasComms: false,
    };

    const result = calculateStrengthScore(
      "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      noTrackingFacts
    );

    expect(result.score).toBe(0.0);
    expect(result.pWinBand).toBe("very_low");
    expect(result.pWin).toBe(WIN_BANDS.very_low.pWin);
  });
});
