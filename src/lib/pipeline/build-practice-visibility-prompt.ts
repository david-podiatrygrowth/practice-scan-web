import { keywordsInPipelineOrder } from "@/lib/pipeline/pipeline-keywords";
import type { PipelineInput, PipelineState } from "./types";

const NOT_PROVIDED = "Not provided";

type ParsedAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

function parseOptionalMetric(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim()) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? String(n) : v.trim();
  }
  return NOT_PROVIDED;
}

function parseFormattedAddress(
  formattedAddress: string,
  input: PipelineInput,
): ParsedAddress {
  const raw = formattedAddress.trim();
  if (!raw) {
    return {
      street: NOT_PROVIDED,
      city: input.city?.trim() || NOT_PROVIDED,
      state: input.state?.trim() || NOT_PROVIDED,
      zip: NOT_PROVIDED,
    };
  }

  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const street = parts[0] ?? NOT_PROVIDED;
    const city = parts[1] ?? (input.city?.trim() || NOT_PROVIDED);
    const stateZip = parts.slice(2).join(", ").trim();
    const m = stateZip.match(/^([A-Za-z]{2})\s+([\d\-]+)\s*$/);
    if (m) {
      return {
        street,
        city,
        state: m[1].toUpperCase(),
        zip: m[2],
      };
    }
    return {
      street,
      city,
      state: input.state?.trim() || stateZip || NOT_PROVIDED,
      zip: NOT_PROVIDED,
    };
  }

  if (parts.length === 2) {
    return {
      street: parts[0] ?? NOT_PROVIDED,
      city: parts[1] ?? NOT_PROVIDED,
      state: input.state?.trim() || NOT_PROVIDED,
      zip: NOT_PROVIDED,
    };
  }

  return {
    street: raw,
    city: input.city?.trim() || NOT_PROVIDED,
    state: input.state?.trim() || NOT_PROVIDED,
    zip: NOT_PROVIDED,
  };
}

function gridLabelFromPayload(payload: Record<string, unknown>): string {
  const g = payload.grid_size;
  if (typeof g === "string" && /^\d+$/.test(g.trim())) {
    const n = g.trim();
    return `${n}x${n}`;
  }
  return "5x5";
}

const MAX_PAYLOAD_EXCERPT = 14_000;

function excerptPayload(payload: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(payload, null, 2);
    if (s.length <= MAX_PAYLOAD_EXCERPT) return s;
    return `${s.slice(0, MAX_PAYLOAD_EXCERPT)}\n… [truncated, ${s.length} chars total]`;
  } catch {
    return NOT_PROVIDED;
  }
}

/**
 * Human-readable scan block per keyword for the prompt (ARP, SoLV, JSON excerpt for competitors / data_points).
 */
export function buildScanDataSummary(state: PipelineState): string {
  const retrieve = state.retrieveScans?.reports ?? [];
  const stubs = state.scans?.reports ?? [];
  const stubByKeyword = new Map(stubs.map((s) => [s.keyword, s]));

  if (retrieve.length === 0) {
    return "No retrieved scan payloads available.";
  }

  const blocks: string[] = [];
  for (const r of retrieve) {
    const stub = stubByKeyword.get(r.keyword);
    const p = r.payload;
    const grid = typeof p.grid_size === "string" ? p.grid_size.trim() : NOT_PROVIDED;
    const radius =
      p.radius != null && String(p.radius).trim() !== ""
        ? String(p.radius)
        : NOT_PROVIDED;
    const measurement =
      typeof p.measurement === "string" && p.measurement.trim()
        ? p.measurement.trim()
        : "mi";

    const arp =
      stub?.arp != null
        ? String(stub.arp)
        : parseOptionalMetric(p.arp);
    const solv =
      stub?.solv != null
        ? String(stub.solv)
        : parseOptionalMetric(p.solv);

    blocks.push(
      [
        `Keyword: ${r.keyword}`,
        `Report key: ${r.reportKey}`,
        `Grid size (points per side): ${grid}`,
        `Radius: ${radius} ${measurement}`,
        `ARP (average rank position): ${arp}`,
        `SoLV (share of local voice): ${solv}`,
        `Full report excerpt (JSON — includes competitor / grid data where present):`,
        excerptPayload(p),
      ].join("\n"),
    );
  }

  return blocks.join("\n\n---\n\n");
}

export type PracticeVisibilityPromptContext = {
  practiceName: string;
  doctorName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  platform: string;
  booking: string;
  reviews: string;
  newsletter: string;
  conditionsMore: string;
  conditionsLess: string;
  challenges: string;
  concerns: string;
  gridLabel: string;
  radiusMi: string;
  keywords: string[];
  scanSummary: string;
};

/**
 * Collects fields for the Jim McDannald / Podiatry Growth template with defaults.
 */
export function buildPracticeVisibilityPromptContext(
  state: PipelineState,
): PracticeVisibilityPromptContext {
  const input = state.input;
  const resolve = state.resolve;
  const scans = state.scans;

  const practiceName =
    input.practiceName?.trim() || resolve?.name?.trim() || NOT_PROVIDED;

  const addr = parseFormattedAddress(
    resolve?.formattedAddress?.trim() ?? "",
    input,
  );

  const reviewHint =
    resolve?.reviewCount != null
      ? `Google listing shows ~${resolve.reviewCount} reviews (rating ${resolve.rating ?? NOT_PROVIDED})`
      : NOT_PROVIDED;

  const firstPayload = state.retrieveScans?.reports[0]?.payload;
  const gridLabel = firstPayload
    ? gridLabelFromPayload(firstPayload)
    : "5x5";

  const radiusMi =
    scans?.scanRadiusMi != null && Number.isFinite(scans.scanRadiusMi)
      ? String(scans.scanRadiusMi)
      : "5";

  const keywords = [...keywordsInPipelineOrder(state)];

  return {
    practiceName,
    doctorName: NOT_PROVIDED,
    street: addr.street,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    website: resolve?.websiteUrl?.trim() || NOT_PROVIDED,
    platform: "Google Maps (Local Falcon geo-grid scan)",
    booking: NOT_PROVIDED,
    reviews: reviewHint,
    newsletter: NOT_PROVIDED,
    conditionsMore: NOT_PROVIDED,
    conditionsLess: NOT_PROVIDED,
    challenges: NOT_PROVIDED,
    concerns: NOT_PROVIDED,
    gridLabel,
    radiusMi,
    keywords,
    scanSummary: buildScanDataSummary(state),
  };
}

/**
 * Full user prompt for Claude — Practice Visibility Scan analysis sections (diagnostic, no solutions).
 * Requires `resolve`, `scans`, and `retrieveScans` on `state`.
 */
export function buildPracticeVisibilityAnalysisPrompt(
  state: PipelineState,
): string {
  const p = buildPracticeVisibilityPromptContext(state);
  const keywordCount =
    p.keywords.length > 0
      ? p.keywords.length
      : (state.retrieveScans?.reports.length ?? 1);

  return (
    "You are Jim McDannald, DPM — a podiatrist who runs a marketing consultancy called Podiatry Growth. " +
    "You're writing the analysis sections for a Practice Visibility Scan report. " +
    "This is a FREE diagnostic report for a prospect. It should show problems clearly but NOT provide solutions or action items. " +
    "The goal is to make them want to book a strategy call.\n\n" +
    "Write in a direct, peer-to-peer tone — one podiatrist talking to another. No marketing jargon. Numbers first, then plain English.\n\n" +
    "PRACTICE INFO:\n" +
    "  Name: " +
    p.practiceName +
    "\n" +
    "  Doctor: " +
    p.doctorName +
    "\n" +
    "  Location: " +
    p.street +
    ", " +
    p.city +
    ", " +
    p.state +
    " " +
    p.zip +
    "\n" +
    "  Website: " +
    p.website +
    "\n" +
    "  Platform: " +
    p.platform +
    "\n" +
    "  Online booking: " +
    p.booking +
    "\n" +
    "  Review system: " +
    p.reviews +
    "\n" +
    "  Newsletter: " +
    p.newsletter +
    "\n" +
    "  Wants MORE of: " +
    p.conditionsMore +
    "\n" +
    "  Wants LESS of: " +
    p.conditionsLess +
    "\n" +
    "  Top challenges: " +
    p.challenges +
    "\n" +
    "  Visibility concerns: " +
    p.concerns +
    "\n\n" +
    "SCAN DATA (" +
    p.gridLabel +
    " grid, " +
    p.radiusMi +
    " mi radius):\n" +
    p.scanSummary +
    "\n\n" +
    "Write the following sections for the report. Use plain text, no markdown formatting.\n\n" +
    "1. STRENGTHS (3 items) — Bold title + 1-2 sentence description of what's working well.\n\n" +
    "2. PROBLEMS (3 items) — Bold title + 1-2 sentence description of what's broken. Create urgency without being fear-based.\n\n" +
    "3. PER-KEYWORD ANALYSIS — For each of the " +
    keywordCount +
    " keywords, write 2-3 sentences. " +
    "Which directions are strong? Which are weak? What competitor is winning where? " +
    "Reference the ARP, SoLV, and competitor data.\n\n" +
    "4. BOTTOM LINE — 3-4 sentences synthesizing the key takeaway. What's working, what's the main problem, what's the opportunity.\n\n" +
    "5. GENERAL OBSERVATIONS (3-4 items) — Positive framing. What the practice has going for it.\n\n" +
    "6. CRITICAL OBSERVATIONS (2-3 items) — The urgent problems. Be specific: name competitors, cite exact numbers.\n\n" +
    "Remember: show problems, not solutions. Make them think 'I need help with this' — not 'I can fix this myself.'"
  );
}
