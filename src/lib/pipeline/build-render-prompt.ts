import { buildScoringSystemPrompt } from "@/app/api/pipeline/render/scoring-system";
import { buildScanDataSummary } from "@/lib/pipeline/build-practice-visibility-prompt";
import { keywordsInPipelineOrder } from "@/lib/pipeline/pipeline-keywords";
import type { PipelineState } from "@/lib/pipeline/types";
import sampleInput from "./visibility-template-sample.json";

const MAX_WEBSITE_MARKDOWN = 12_000;

const OUTPUT_KEYS_EXAMPLE = JSON.stringify(sampleInput, null, 2);

const REPORT_GUIDE = `
The final Word document is filled by docxtemplater from your JSON. Keys are snake_case and must match the output contract exactly. Loops: swot_items (strength + problem pairs), neighborhoods, general_observations, critical_observations (each with the field names shown in the sample). Keyword fields kw1_* and kw2_* correspond to the first and second keywords in PIPELINE_KEYWORDS_IN_ORDER. Write clear, professional prose; no HTML.
`.trim();

function collateUserContext(state: PipelineState): string {
  const wm = state.website?.markdown ?? "";
  const website =
    wm.length > MAX_WEBSITE_MARKDOWN
      ? `${wm.slice(0, MAX_WEBSITE_MARKDOWN)}\n\n[website markdown truncated]`
      : wm;

  const keywords = keywordsInPipelineOrder(state);

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
    "You are generating the structured JSON data for a Practice Visibility Scan Word report. Output must be a single JSON object only (no markdown outside JSON).",
    "",
    "--- Narrative & structure ---",
    REPORT_GUIDE,
    "",
    "--- Scoring (category scores must follow this rubric and sum correctly) ---",
    buildScoringSystemPrompt(),
    "",
    "--- Output contract ---",
    "Return ONLY valid JSON with **every key present** in this sample (same snake_case names). Use the sample as a structural reference — replace placeholder text with real content derived from the pipeline payload:",
    "",
    OUTPUT_KEYS_EXAMPLE,
    "",
    "Rules:",
    "- Do not rename keys or change nesting. Arrays may have different lengths but must use the same object shapes as the sample.",
    "- `kw1_*` maps to PIPELINE_KEYWORDS_IN_ORDER[0], `kw2_*` to [1]. Descriptions: plain English for a practice owner.",
    "- `overall_score` and `score_*` / `status_*` strings must match the scoring rubric (e.g. score_website like \"13 / 20\").",
    "- swot_items: prefer 3 rows; neighborhoods: 4–6; general_observations: 3–4; critical_observations: 2–3.",
    "- Escape double quotes inside strings. No HTML.",
    "- `demographic_intro` / `demographic_conclusion` synthesize the demographics pipeline section; cite patterns, not fake precision.",
  ].join("\n");
}

export function buildRenderUserPrompt(state: PipelineState): string {
  return [
    "Pipeline state JSON (source of truth). Produce the report JSON from this data.",
    "",
    collateUserContext(state),
  ].join("\n");
}
