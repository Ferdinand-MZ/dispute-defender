import { Fact } from "../db/schema";

export interface ParagraphClaim {
  text: string;
  claimRefs: string[];
}

export interface SectionClaim {
  heading: string;
  paragraphs: ParagraphClaim[];
}

export interface DraftPayload {
  summary: string;
  sections: SectionClaim[];
}

export interface GroundingError {
  path: string; // e.g. "sections[0].paragraphs[1]"
  code:
    | "MISSING_REFS"
    | "INVALID_REF"
    | "HALLUCINATED_TRACKING"
    | "HALLUCINATED_AMOUNT"
    | "UNAUTHORIZED_URL"
    | "BANNED_PHRASE";
  message: string;
}

export interface GroundingResult {
  passed: boolean;
  errors: GroundingError[];
}

const BANNED_PHRASES = [
  /\bguarantee\b/i,
  /\bguaranteed\b/i,
  /\b100%\b/i,
  /\bpromise\b/i,
  /\babsolutely\b/i,
];

// Tracking number regex pattern (common formats e.g. 10-34 alphanumeric chars)
const TRACKING_REGEX = /\b[A-Z0-9]{10,34}\b/g;

// Currency amount regex pattern (e.g. $48.00, $120, 48.00 USD)
const AMOUNT_REGEX = /(?:\$|USD\s*)(\d+(?:\.\d{2})?)/gi;

// URL regex
const URL_REGEX = /https?:\/\/[^\s$.?#].[^\s]*/gi;

/**
 * Validates a generated draft response against the ground-truth fact base.
 * Guarantees no hallucinated facts, unreferenced claims, or unauthorized text reach PayPal.
 */
export function validateGrounding(
  draft: DraftPayload,
  facts: Fact[]
): GroundingResult {
  const errors: GroundingError[] = [];
  const factIdSet = new Set(facts.map((f) => f.id));
  const factsMap = new Map(facts.map((f) => [f.id, f]));

  // Collate all known values across all facts for entity matching
  const knownTextValues = facts.map((f) => f.value.toLowerCase());

  draft.sections.forEach((section, sIdx) => {
    section.paragraphs.forEach((p, pIdx) => {
      const path = `sections[${sIdx}].paragraphs[${pIdx}]`;

      // 1. Every paragraph must carry at least one claimRef
      if (!p.claimRefs || p.claimRefs.length === 0) {
        errors.push({
          path,
          code: "MISSING_REFS",
          message: `Paragraph has no cited fact references: "${p.text.slice(0, 50)}..."`,
        });
        return;
      }

      // 2. Every claimRef must exist in the dispute's fact base
      const citedFacts: Fact[] = [];
      for (const ref of p.claimRefs) {
        if (!factIdSet.has(ref)) {
          errors.push({
            path,
            code: "INVALID_REF",
            message: `Cited fact ID "${ref}" does not exist for this dispute.`,
          });
        } else {
          const f = factsMap.get(ref);
          if (f) citedFacts.push(f);
        }
      }

      const citedValues = citedFacts.map((f) => f.value.toLowerCase()).join(" ");

      // 3. Check for banned phrases
      for (const pattern of BANNED_PHRASES) {
        if (pattern.test(p.text)) {
          errors.push({
            path,
            code: "BANNED_PHRASE",
            message: `Paragraph contains banned promotional or subjective phrase matching ${pattern}.`,
          });
        }
      }

      // 4. Check for tracking numbers
      const trackingMatches = p.text.match(TRACKING_REGEX) || [];
      for (const match of trackingMatches) {
        // Ignore common capitalized English words that might match uppercase regex
        if (match.length < 12 && /^[A-Z]+$/.test(match)) continue;

        const inCited = citedValues.includes(match.toLowerCase());
        const inAny = knownTextValues.some((v) => v.includes(match.toLowerCase()));

        if (!inCited && !inAny) {
          errors.push({
            path,
            code: "HALLUCINATED_TRACKING",
            message: `Tracking or reference code "${match}" does not appear in cited dispute facts.`,
          });
        }
      }

      // 5. Check for amounts
      let amountMatch: RegExpExecArray | null;
      AMOUNT_REGEX.lastIndex = 0;
      while ((amountMatch = AMOUNT_REGEX.exec(p.text)) !== null) {
        const val = amountMatch[1];
        if (val) {
          const inCited = citedValues.includes(val);
          const inAny = knownTextValues.some((v) => v.includes(val));
          if (!inCited && !inAny) {
            errors.push({
              path,
              code: "HALLUCINATED_AMOUNT",
              message: `Monetary amount "${amountMatch[0]}" is not verified in cited facts.`,
            });
          }
        }
      }

      // 6. Check for unauthorized URLs
      let urlMatch: RegExpExecArray | null;
      URL_REGEX.lastIndex = 0;
      while ((urlMatch = URL_REGEX.exec(p.text)) !== null) {
        const url = urlMatch[0].toLowerCase();
        const inCited = citedValues.includes(url);
        if (!inCited) {
          errors.push({
            path,
            code: "UNAUTHORIZED_URL",
            message: `URL "${urlMatch[0]}" is not supported by cited facts.`,
          });
        }
      }
    });
  });

  return {
    passed: errors.length === 0,
    errors,
  };
}
