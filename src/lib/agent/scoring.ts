export interface ScoreBreakdownItem {
  signal: string;
  weight: number;
  satisfied: boolean;
  notes: string;
}

export interface StrengthScoreResult {
  reason: string;
  score: number; // 0.00 to 1.00
  scorePercent: number; // 0 to 100
  pWinBand: "high" | "medium" | "low" | "very_low";
  pWin: number; // 0.75, 0.50, 0.30, 0.10
  breakdown: ScoreBreakdownItem[];
}

export interface FactSummary {
  hasTracking: boolean;
  hasDelivered: boolean;
  addressMatch: boolean;
  hasShippingPolicy: boolean;
  hasComms: boolean;
  hasListingMatch?: boolean;
  hasPhotos?: boolean;
  hasReturnPolicy?: boolean;
}

export const WIN_BANDS = {
  high: { minScore: 0.8, pWin: 0.75, label: "High Likelihood" },
  medium: { minScore: 0.6, pWin: 0.5, label: "Medium Likelihood" },
  low: { minScore: 0.4, pWin: 0.3, label: "Low Likelihood" },
  very_low: { minScore: 0.0, pWin: 0.1, label: "Very Low Likelihood" },
} as const;

export function calculateStrengthScore(
  reason: string,
  facts: FactSummary
): StrengthScoreResult {
  const breakdown: ScoreBreakdownItem[] = [];

  if (reason === "MERCHANDISE_OR_SERVICE_NOT_RECEIVED") {
    breakdown.push({
      signal: "Carrier & tracking number present",
      weight: 0.35,
      satisfied: !!facts.hasTracking,
      notes: facts.hasTracking
        ? "Valid tracking and carrier verified"
        : "Missing shipment tracking record",
    });
    breakdown.push({
      signal: "Delivery confirmed with date",
      weight: 0.3,
      satisfied: !!facts.hasDelivered,
      notes: facts.hasDelivered
        ? "Carrier reports delivered to destination"
        : "No confirmed delivery scan",
    });
    breakdown.push({
      signal: "Delivery address matches order",
      weight: 0.15,
      satisfied: !!facts.addressMatch,
      notes: facts.addressMatch
        ? "Shipment address verified identical to PayPal order"
        : "Address mismatch or unverified",
    });
    breakdown.push({
      signal: "Shipping policy on file",
      weight: 0.1,
      satisfied: !!facts.hasShippingPolicy,
      notes: facts.hasShippingPolicy
        ? "Active store shipping policy attached"
        : "Missing published shipping policy",
    });
    breakdown.push({
      signal: "Communication log present",
      weight: 0.1,
      satisfied: !!facts.hasComms,
      notes: facts.hasComms
        ? "Pre-dispute customer messaging records exist"
        : "No prior customer communication recorded",
    });
  } else {
    // MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED
    breakdown.push({
      signal: "Item description match on record",
      weight: 0.3,
      satisfied: !!facts.hasListingMatch,
      notes: facts.hasListingMatch
        ? "Detailed product specification on record"
        : "Missing product specification",
    });
    breakdown.push({
      signal: "Fulfillment & tracking confirmed",
      weight: 0.2,
      satisfied: !!facts.hasTracking,
      notes: facts.hasTracking
        ? "Package dispatched and tracked"
        : "Missing fulfillment proof",
    });
    breakdown.push({
      signal: "Photos or listing snapshot",
      weight: 0.2,
      satisfied: !!facts.hasPhotos,
      notes: facts.hasPhotos
        ? "Catalog photo and condition verified"
        : "No visual product records",
    });
    breakdown.push({
      signal: "Return policy published",
      weight: 0.15,
      satisfied: !!facts.hasReturnPolicy,
      notes: facts.hasReturnPolicy
        ? "Store return policy active"
        : "Missing store return policy",
    });
    breakdown.push({
      signal: "Customer communication history",
      weight: 0.15,
      satisfied: !!facts.hasComms,
      notes: facts.hasComms
        ? "Pre-dispute inquiry and support log present"
        : "No customer messaging history",
    });
  }

  const scoreRaw = breakdown.reduce((acc, item) => {
    return acc + (item.satisfied ? item.weight : 0);
  }, 0);

  const score = Math.round(scoreRaw * 100) / 100;
  const scorePercent = Math.round(score * 100);

  let pWinBand: "high" | "medium" | "low" | "very_low" = "very_low";
  let pWin: number = WIN_BANDS.very_low.pWin;

  if (score >= WIN_BANDS.high.minScore) {
    pWinBand = "high";
    pWin = WIN_BANDS.high.pWin;
  } else if (score >= WIN_BANDS.medium.minScore) {
    pWinBand = "medium";
    pWin = WIN_BANDS.medium.pWin;
  } else if (score >= WIN_BANDS.low.minScore) {
    pWinBand = "low";
    pWin = WIN_BANDS.low.pWin;
  }

  return {
    reason,
    score,
    scorePercent,
    pWinBand,
    pWin,
    breakdown,
  };
}
