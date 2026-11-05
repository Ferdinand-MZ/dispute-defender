import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { Dispute, Order, Fact, Draft } from "../db/schema";
import { formatMoney } from "../money";
import { DraftPayload } from "../agent/grounding";

export interface GenerateEvidencePacketParams {
  dispute: Dispute;
  order?: Order | null;
  facts: Fact[];
  draft: Draft;
  approvedBy: string;
  approvedAt?: string;
}

export interface EvidencePacketResult {
  buffer: Uint8Array;
  filename: string;
  mimeType: "application/pdf";
}

/**
 * Sanitizes strings to WinAnsi-compatible ASCII characters so pdf-lib StandardFonts never throw encoding errors.
 */
function sanitizePdfText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\n\r\t]/g, "");
}

/**
 * Wraps a single paragraph into multiple lines that fit within maxWidth.
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const clean = sanitizePdfText(text).replace(/\r\n/g, "\n");
  const rawParagraphs = clean.split("\n");
  const lines: string[] = [];

  for (const rawPara of rawParagraphs) {
    const words = rawPara.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${currentLine} ${words[i]}`;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generates an official, self-contained PDF evidence dossier for PayPal dispute submission (Task T20).
 * Every narrative claim and appendix item is linked to verified fact IDs.
 */
export async function generateEvidencePacketPdf({
  dispute,
  order,
  facts,
  draft,
  approvedBy,
  approvedAt,
}: GenerateEvidencePacketParams): Promise<EvidencePacketResult> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Evidence Packet - ${dispute.paypalDisputeId}`);
  pdfDoc.setSubject(`PayPal Dispute Evidence Submission for ${dispute.paypalDisputeId}`);
  pdfDoc.setCreator("DisputeDefender Evidence Copilot");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612; // Letter width (8.5in * 72)
  const pageHeight = 792; // Letter height (11in * 72)
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
    }
  };

  const drawWrappedBlock = (
    text: string,
    font: PDFFont,
    fontSize: number,
    color = rgb(0.15, 0.18, 0.22),
    indent = 0,
    lineGap = 4
  ) => {
    const lines = wrapText(text, font, fontSize, contentWidth - indent);
    for (const line of lines) {
      ensureSpace(fontSize + lineGap);
      if (line.length > 0) {
        page.drawText(line, {
          x: margin + indent,
          y: cursorY - fontSize,
          size: fontSize,
          font,
          color,
        });
      }
      cursorY -= fontSize + lineGap;
    }
  };

  const drawHorizontalRule = () => {
    ensureSpace(16);
    cursorY -= 6;
    page.drawLine({
      start: { x: margin, y: cursorY },
      end: { x: pageWidth - margin, y: cursorY },
      thickness: 0.75,
      color: rgb(0.82, 0.85, 0.88),
    });
    cursorY -= 10;
  };

  // 1. Document Header
  drawWrappedBlock(
    "DISPUTEDEFENDER - MERCHANT EVIDENCE PACKET",
    fontBold,
    14,
    rgb(0.06, 0.14, 0.32)
  );
  drawWrappedBlock(
    `PayPal Sandbox Dispute Dossier | Generated ${approvedAt || new Date().toISOString()}`,
    fontRegular,
    9,
    rgb(0.4, 0.45, 0.52)
  );
  drawHorizontalRule();

  // 2. Case & Order Summary Metadata
  drawWrappedBlock("1. DISPUTE & TRANSACTION SUMMARY", fontBold, 11, rgb(0.06, 0.14, 0.32));
  cursorY -= 2;

  const formattedAmount = formatMoney(dispute.amountMinor, dispute.currency);
  const metadataLines = [
    `PayPal Dispute ID: ${dispute.paypalDisputeId}`,
    `Dispute Reason: ${dispute.reason}`,
    `Disputed Amount: ${formattedAmount} (${dispute.currency})`,
    `Merchant Order ID: ${order?.id || dispute.orderId || "N/A"}`,
    `PayPal Capture ID: ${order?.captureId || dispute.captureId || "N/A"}`,
    `Shipment Carrier & Tracking: ${
      order?.carrier && order?.trackingNumber
        ? `${order.carrier} (${order.trackingNumber})`
        : "See verified fact base below"
    }`,
    `Evidence Category: ${draft.evidenceType}`,
    `Grounding Validation Status: ${draft.groundingStatus.toUpperCase()}`,
    `Approved By (Human Gate): ${approvedBy}`,
  ];

  for (const meta of metadataLines) {
    drawWrappedBlock(meta, fontRegular, 9.5, rgb(0.15, 0.18, 0.22), 8, 3);
  }

  drawHorizontalRule();

  // 3. Approved Grounded Merchant Response Narrative
  drawWrappedBlock("2. GROUNDED MERCHANT RESPONSE NARRATIVE", fontBold, 11, rgb(0.06, 0.14, 0.32));
  cursorY -= 4;

  let parsedBody: DraftPayload | null = null;
  try {
    parsedBody = JSON.parse(draft.bodyJson) as DraftPayload;
  } catch {
    parsedBody = null;
  }

  if (parsedBody) {
    if (parsedBody.summary) {
      drawWrappedBlock(`Executive Summary: ${parsedBody.summary}`, fontBold, 9.5, rgb(0.2, 0.24, 0.3));
      cursorY -= 4;
    }

    for (const section of parsedBody.sections || []) {
      ensureSpace(28);
      drawWrappedBlock(section.heading, fontBold, 10, rgb(0.1, 0.2, 0.4));
      for (const para of section.paragraphs || []) {
        const refsLabel =
          para.claimRefs && para.claimRefs.length > 0
            ? ` [Citations: ${para.claimRefs.map((r) => `#${r}`).join(", ")}]`
            : "";
        drawWrappedBlock(`${para.text}${refsLabel}`, fontRegular, 9.5, rgb(0.15, 0.18, 0.22), 8, 4);
        cursorY -= 3;
      }
      cursorY -= 4;
    }
  } else if (draft.notesText) {
    drawWrappedBlock(draft.notesText, fontRegular, 9.5, rgb(0.15, 0.18, 0.22), 8, 4);
  }

  drawHorizontalRule();

  // 4. Verified Fact Base Appendix (Excludes untrusted external inputs)
  drawWrappedBlock("3. VERIFIED MERCHANT FACT BASE APPENDIX", fontBold, 11, rgb(0.06, 0.14, 0.32));
  cursorY -= 4;

  const verifiedFacts = facts.filter(
    (f) =>
      f &&
      f.untrusted === 0 &&
      typeof f.id === "string" &&
      typeof f.kind === "string" &&
      typeof f.label === "string" &&
      typeof f.value === "string"
  );
  if (verifiedFacts.length === 0) {
    drawWrappedBlock("No verified merchant facts recorded.", fontRegular, 9.5, rgb(0.4, 0.45, 0.52), 8);
  } else {
    for (const f of verifiedFacts) {
      ensureSpace(26);
      drawWrappedBlock(
        `[${f.id}] (${f.kind.toUpperCase()}) ${f.label} — Source: ${f.source}`,
        fontBold,
        9,
        rgb(0.12, 0.22, 0.36),
        6,
        2
      );
      drawWrappedBlock(f.value, fontRegular, 9, rgb(0.2, 0.24, 0.28), 14, 3);
      cursorY -= 4;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const safeDisputeId = dispute.paypalDisputeId.replace(/[^a-zA-Z0-9_-]/g, "_");

  return {
    buffer: pdfBytes,
    filename: `evidence-packet-${safeDisputeId}-v${draft.version || 1}.pdf`,
    mimeType: "application/pdf",
  };
}
