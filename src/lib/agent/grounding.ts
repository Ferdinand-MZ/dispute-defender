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
  path: string; // e.g. "sections[0].paragraphs[1]", "summary", "sections[0].heading"
  code:
    | "MISSING_REFS"
    | "INVALID_REF"
    | "UNTRUSTED_REF"
    | "HALLUCINATED_TRACKING"
    | "HALLUCINATED_AMOUNT"
    | "HALLUCINATED_CARRIER"
    | "HALLUCINATED_DATE"
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

// Tracking number regex pattern (case-insensitive, 9-34 chars)
const TRACKING_REGEX = /\b[A-Za-z0-9]{9,34}\b/g;

// Currency amount regex pattern (supports $, USD, EUR, GBP, JPY, and comma separators like $1,200.00)
const AMOUNT_REGEX = /(?:[\$£€¥]|(?:USD|EUR|GBP|JPY)\s*)((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)|((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s*(?:USD|EUR|GBP|JPY)/gi;

// Carrier names regex
const CARRIER_REGEX = /\b(FEDEX|UPS|USPS|DHL|ONTRAC|LASERSHIP|ROYAL MAIL|CANADA POST|DPD|HERMES|PUROLATOR)\b/gi;

// Date regex: ISO YYYY-MM-DD, MM/DD/YYYY, or Month DD, YYYY
const DATE_REGEX = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi;

// URL regex
const URL_REGEX = /https?:\/\/[^\s$.?#].[^\s]*/gi;

function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  AMOUNT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMOUNT_REGEX.exec(text)) !== null) {
    const rawVal = match[1] || match[2];
    if (rawVal) {
      const num = parseFloat(rawVal.replace(/,/g, ""));
      if (!Number.isNaN(num)) {
        amounts.push(num);
      }
    }
  }
  return amounts;
}

function normalizeDate(dateStr: string): string | null {
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function extractDates(text: string): string[] {
  const dates: string[] = [];
  DATE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DATE_REGEX.exec(text)) !== null) {
    const normalized = normalizeDate(match[0]);
    if (normalized) {
      dates.push(normalized);
    }
  }
  return dates;
}

function extractCarriers(text: string): string[] {
  const carriers: string[] = [];
  CARRIER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CARRIER_REGEX.exec(text)) !== null) {
    carriers.push(match[0].toUpperCase().replace(/\s+/g, " "));
  }
  return Array.from(new Set(carriers));
}

function extractTracking(text: string): string[] {
  const tracking: string[] = [];
  TRACKING_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TRACKING_REGEX.exec(text)) !== null) {
    const val = match[0];
    // Carrier tracking numbers always contain digits; purely alphabetical tokens are words
    // ("confirmation", "successfully") and must not be treated as reference codes.
    if (/^[A-Za-z]+$/.test(val)) continue;
    // Ignore pure dates like 20261020 or 2026
    if (/^\d{4}$/.test(val)) continue;
    tracking.push(val.toLowerCase());
  }
  return tracking;
}

/**
 * Validates text content (paragraph, summary, or heading) against an allowed set of trusted facts.
 */
function validateContentEntities(
  text: string,
  path: string,
  trustedFacts: Fact[],
  errors: GroundingError[]
): void {
  const trustedTextCombined = trustedFacts.map((f) => f.value.toLowerCase()).join(" ");

  // 1. Check for banned phrases
  for (const pattern of BANNED_PHRASES) {
    if (pattern.test(text)) {
      errors.push({
        path,
        code: "BANNED_PHRASE",
        message: `Content contains banned promotional or subjective phrase matching ${pattern}.`,
      });
    }
  }

  // 2. Check for unauthorized URLs
  URL_REGEX.lastIndex = 0;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = URL_REGEX.exec(text)) !== null) {
    const url = urlMatch[0].toLowerCase();
    if (!trustedTextCombined.includes(url)) {
      errors.push({
        path,
        code: "UNAUTHORIZED_URL",
        message: `URL "${urlMatch[0]}" is not supported by cited facts.`,
      });
    }
  }

  // 3. Check for tracking numbers
  const textTrackings = extractTracking(text);
  for (const trk of textTrackings) {
    if (!trustedTextCombined.includes(trk)) {
      errors.push({
        path,
        code: "HALLUCINATED_TRACKING",
        message: `Tracking or reference code "${trk}" does not appear in cited dispute facts.`,
      });
    }
  }

  // 4. Check for monetary amounts (exact numeric comparison, no false substring matching)
  const textAmounts = extractAmounts(text);
  const factsAmounts: number[] = [];
  for (const f of trustedFacts) {
    factsAmounts.push(...extractAmounts(f.value));
  }

  for (const amt of textAmounts) {
    const matched = factsAmounts.some((factAmt) => Math.abs(amt - factAmt) < 0.001);
    if (!matched) {
      errors.push({
        path,
        code: "HALLUCINATED_AMOUNT",
        message: `Monetary amount "${amt}" is not verified in cited facts.`,
      });
    }
  }

  // 5. Check for carrier names
  const textCarriers = extractCarriers(text);
  const factsCarriers: string[] = [];
  for (const f of trustedFacts) {
    factsCarriers.push(...extractCarriers(f.value));
  }

  for (const carrier of textCarriers) {
    if (!factsCarriers.includes(carrier)) {
      errors.push({
        path,
        code: "HALLUCINATED_CARRIER",
        message: `Carrier "${carrier}" is not supported by cited facts.`,
      });
    }
  }

  // 6. Check for dates
  const textDates = extractDates(text);
  const factsDates: string[] = [];
  for (const f of trustedFacts) {
    factsDates.push(...extractDates(f.value));
  }

  for (const dt of textDates) {
    if (!factsDates.includes(dt)) {
      errors.push({
        path,
        code: "HALLUCINATED_DATE",
        message: `Date "${dt}" is not verified in cited facts.`,
      });
    }
  }
}

/**
 * Validates a generated draft response against the ground-truth fact base.
 * Guarantees no hallucinated facts, unreferenced claims, or unauthorized text reach PayPal.
 * Enforces Rule 2: LLM output may only restate records from the facts table.
 */
export function validateGrounding(
  draft: DraftPayload,
  facts: Fact[]
): GroundingResult {
  const errors: GroundingError[] = [];
  const factIdSet = new Set(facts.map((f) => f.id));
  const factsMap = new Map(facts.map((f) => [f.id, f]));
  const trustedDisputeFacts = facts.filter((f) => f.untrusted === 0);

  // Collect all cited trusted facts across the entire draft for validating summary and headings
  const allCitedFactIds = new Set<string>();
  draft.sections.forEach((s) => {
    s.paragraphs.forEach((p) => {
      (p.claimRefs || []).forEach((ref) => allCitedFactIds.add(ref));
    });
  });

  const allCitedTrustedFacts = Array.from(allCitedFactIds)
    .map((ref) => factsMap.get(ref))
    .filter((f): f is Fact => Boolean(f && f.untrusted === 0));

  // Validate draft summary
  if (draft.summary) {
    validateContentEntities(
      draft.summary,
      "summary",
      allCitedTrustedFacts.length > 0 ? allCitedTrustedFacts : trustedDisputeFacts,
      errors
    );
  }

  draft.sections.forEach((section, sIdx) => {
    // Validate section heading
    if (section.heading) {
      validateContentEntities(
        section.heading,
        `sections[${sIdx}].heading`,
        allCitedTrustedFacts.length > 0 ? allCitedTrustedFacts : trustedDisputeFacts,
        errors
      );
    }

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

      // 2. Every claimRef must exist in the dispute's fact base and MUST NOT be untrusted
      const citedTrustedFacts: Fact[] = [];
      for (const ref of p.claimRefs) {
        if (!factIdSet.has(ref)) {
          errors.push({
            path,
            code: "INVALID_REF",
            message: `Cited fact ID "${ref}" does not exist for this dispute.`,
          });
        } else {
          const f = factsMap.get(ref);
          if (f) {
            if (f.untrusted === 1) {
              errors.push({
                path,
                code: "UNTRUSTED_REF",
                message: `Cited fact ID "${ref}" is an untrusted buyer source and cannot be cited as grounded evidence.`,
              });
            } else {
              citedTrustedFacts.push(f);
            }
          }
        }
      }

      // If no valid trusted facts are cited, do not validate against empty set (already invalid)
      if (citedTrustedFacts.length === 0) {
        return;
      }

      // 3. Strictly validate paragraph content against the paragraph's cited trusted facts
      validateContentEntities(p.text, path, citedTrustedFacts, errors);
    });
  });

  return {
    passed: errors.length === 0,
    errors,
  };
}
