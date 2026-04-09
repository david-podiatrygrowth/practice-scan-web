import { REPORT_TEMPLATE } from "@/app/api/pipeline/render/report-template";
import { buildScoringSystemPrompt } from "@/app/api/pipeline/render/scoring-system";
import { buildScanDataSummary } from "@/lib/pipeline/build-practice-visibility-prompt";
import type { PipelineState } from "@/lib/pipeline/types";

const MAX_WEBSITE_MARKDOWN = 12_000;

const JSON_EXAMPLE = `{
  "practiceName": "string",
  "cityStateLine": "City, ST",
  "areaDescription": "short area phrase for title block",
  "visibilityScore": 0,
  "scoreLabel": "e.g. Fair — Significant Room to Grow",
  "strengths": [{ "title": "string", "body": "1–2 sentences" }],
  "problems": [{ "title": "string", "body": "1–2 sentences" }],
  "scanIntro": "One paragraph — same idea as template legend intro",
  "legendGreen": "1–3 = Patients see you first",
  "legendYellow": "4–7 = Have to scroll to find you",
  "legendRed": "8+ = You don't show up",
  "keywordSections": [
    { "keyword": "must match PIPELINE_KEYWORDS order", "statsLine": "Average Rank: … | SoLV: … | Found …", "analysis": "2–3 sentences" }
  ],
  "bottomLine": "3–4 sentences",
  "practiceInfo": {
    "practiceName": "",
    "doctorName": "",
    "website": "",
    "locations": "",
    "reportDate": "human-readable date"
  },
  "scoreSummary": [
    { "category": "Website Fundamentals", "score": 0, "status": "short label" },
    { "category": "Google Business Profile", "score": 0, "status": "" },
    { "category": "Local Search Rankings", "score": 0, "status": "" },
    { "category": "Online Reviews", "score": 0, "status": "" },
    { "category": "Content & SEO", "score": 0, "status": "" },
    { "category": "Patient Engagement", "score": 0, "status": "" }
  ],
  "demographicsIntro": "paragraph",
  "incomeRows": [{ "neighborhood": "", "income": "$…", "highlightPracticeRow": false }],
  "demographicsAnalysis": "2–3 sentences",
  "generalObservations": [{ "title": "", "body": "" }],
  "criticalObservations": [{ "title": "", "body": "" }],
  "ctaHeadline": "Questions about this report? Let's talk.",
  "ctaContactLine": "jim@podiatrygrowth.com  |  podiatrygrowth.com",
  "ctaScheduleLine": "Schedule a call: …"
}`;

function collateUserContext(state: PipelineState): string {
  const wm = state.website?.markdown ?? "";
  const website =
    wm.length > MAX_WEBSITE_MARKDOWN
      ? `${wm.slice(0, MAX_WEBSITE_MARKDOWN)}\n\n[website markdown truncated]`
      : wm;

  const keywords =
    state.scans?.keywords?.length
      ? state.scans.keywords
      : (state.retrieveScans?.reports.map((r) => r.keyword) ?? []);

  const payload = {
    PIPELINE_KEYWORDS_IN_ORDER: keywords,
    input: state.input,
    resolve: state.resolve,
    analyzeGbp: state.analyzeGbp,
    scans: state.scans,
    scanDataSummary: buildScanDataSummary(state),
    analyzeScan: state.analyzeScan,
    website: state.website
      ? { ...state.website, markdown: website }
      : undefined,
    analyzeWebsite: state.analyzeWebsite,
    demographics: state.demographics,
  };

  return JSON.stringify(payload, null, 2);
}

export function buildRenderSystemPrompt(): string {
  return [
    "You are generating structured report content for a Practice Visibility Scan. Output must be a single JSON object only (no markdown outside JSON).",
    "",
    "--- Report template (structure, tone, what to include) ---",
    REPORT_TEMPLATE,
    "",
    "--- Scoring (category scores must follow this rubric and sum correctly) ---",
    buildScoringSystemPrompt(),
    "",
    "--- Output contract ---",
    "Return ONLY valid JSON matching this shape (keys required; use empty strings or [] if needed):",
    JSON_EXAMPLE,
    "",
    "Rules:",
    "- `keywordSections` MUST list keywords in the exact same order as `PIPELINE_KEYWORDS_IN_ORDER` in the user payload.",
    "- Derive scores and copy from the supplied pipeline data; do not invent scan numbers that contradict the payload.",
    "- Strengths/problems: exactly 3 items each unless data truly supports fewer (prefer 3).",
    "- General observations: 3–4 items; critical observations: 2–3 items.",
    "- No HTML. Escape any double quotes inside strings.",
    "- Category scores in scoreSummary must be integers 0–max per category (20 or 10) and align with the scoring rubric.",
  ].join("\n");
}

export function buildRenderUserPrompt(state: PipelineState): string {
  return [
    "Pipeline state JSON (source of truth). Produce the report JSON from this data.",
    "",
    collateUserContext(state),
  ].join("\n");
}
