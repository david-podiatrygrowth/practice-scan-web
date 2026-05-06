/**
 * Claude returns this JSON; docxtemplater merges it into `visibility_report_template.docx`.
 * Keys are snake_case and match `templates/practice_visibilty_scan_sample_input.json`.
 */

export type TemplateSwotRow = {
  strength_title: string;
  strength_description: string;
  problem_title: string;
  problem_description: string;
};

export type TemplateNeighborhoodRow = {
  neighborhood_name: string;
  neighborhood_income: string;
};

export type TemplateObservationRow = {
  obs_title: string;
  obs_description: string;
};

export type VisibilityReportTemplateData = {
  practice_name: string;
  doctor_name: string;
  website: string;
  location_city_state: string;
  location_address: string;
  market_area: string;
  practice_city: string;
  practice_city_income: string;
  report_date: string;
  overall_score: string;
  score_label: string;
  score_website: string;
  status_website: string;
  score_gbp: string;
  status_gbp: string;
  score_rankings: string;
  status_rankings: string;
  score_reviews: string;
  status_reviews: string;
  score_content: string;
  status_content: string;
  score_engagement: string;
  status_engagement: string;
  kw1_term: string;
  kw1_avg_rank: string;
  kw1_solv: string;
  kw1_found: string;
  kw1_total: string;
  kw1_pct: string;
  kw1_description: string;
  kw2_term: string;
  kw2_avg_rank: string;
  kw2_solv: string;
  kw2_found: string;
  kw2_total: string;
  kw2_pct: string;
  kw2_description: string;
  bottom_line: string;
  demographic_intro: string;
  demographic_conclusion: string;
  swot_items: TemplateSwotRow[];
  neighborhoods: TemplateNeighborhoodRow[];
  general_observations: TemplateObservationRow[];
  critical_observations: TemplateObservationRow[];
};

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asSwotRows(v: unknown): TemplateSwotRow[] {
  if (!Array.isArray(v)) return [];
  return v.map((row) => {
    const o = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      strength_title: asStr(o.strength_title),
      strength_description: asStr(o.strength_description),
      problem_title: asStr(o.problem_title),
      problem_description: asStr(o.problem_description),
    };
  });
}

function asNeighborhoodRows(v: unknown): TemplateNeighborhoodRow[] {
  if (!Array.isArray(v)) return [];
  return v.map((row) => {
    const o = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      neighborhood_name: asStr(o.neighborhood_name),
      neighborhood_income: asStr(o.neighborhood_income),
    };
  });
}

function asObservationRows(v: unknown): TemplateObservationRow[] {
  if (!Array.isArray(v)) return [];
  return v.map((row) => {
    const o = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      obs_title: asStr(o.obs_title),
      obs_description: asStr(o.obs_description),
    };
  });
}

export function parseVisibilityReportTemplateJson(
  raw: unknown,
): VisibilityReportTemplateData {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    practice_name: asStr(o.practice_name),
    doctor_name: asStr(o.doctor_name),
    website: asStr(o.website),
    location_city_state: asStr(o.location_city_state),
    location_address: asStr(o.location_address),
    market_area: asStr(o.market_area),
    practice_city: asStr(o.practice_city),
    practice_city_income: asStr(o.practice_city_income),
    report_date: asStr(o.report_date),
    overall_score: asStr(o.overall_score),
    score_label: asStr(o.score_label),
    score_website: asStr(o.score_website),
    status_website: asStr(o.status_website),
    score_gbp: asStr(o.score_gbp),
    status_gbp: asStr(o.status_gbp),
    score_rankings: asStr(o.score_rankings),
    status_rankings: asStr(o.status_rankings),
    score_reviews: asStr(o.score_reviews),
    status_reviews: asStr(o.status_reviews),
    score_content: asStr(o.score_content),
    status_content: asStr(o.status_content),
    score_engagement: asStr(o.score_engagement),
    status_engagement: asStr(o.status_engagement),
    kw1_term: asStr(o.kw1_term),
    kw1_avg_rank: asStr(o.kw1_avg_rank),
    kw1_solv: asStr(o.kw1_solv),
    kw1_found: asStr(o.kw1_found),
    kw1_total: asStr(o.kw1_total),
    kw1_pct: asStr(o.kw1_pct),
    kw1_description: asStr(o.kw1_description),
    kw2_term: asStr(o.kw2_term),
    kw2_avg_rank: asStr(o.kw2_avg_rank),
    kw2_solv: asStr(o.kw2_solv),
    kw2_found: asStr(o.kw2_found),
    kw2_total: asStr(o.kw2_total),
    kw2_pct: asStr(o.kw2_pct),
    kw2_description: asStr(o.kw2_description),
    bottom_line: asStr(o.bottom_line),
    demographic_intro: asStr(o.demographic_intro),
    demographic_conclusion: asStr(o.demographic_conclusion),
    swot_items: asSwotRows(o.swot_items),
    neighborhoods: asNeighborhoodRows(o.neighborhoods),
    general_observations: asObservationRows(o.general_observations),
    critical_observations: asObservationRows(o.critical_observations),
  };
}

/** Strip optional ```json fence and parse; tolerates short preamble after the fence. */
export function extractJsonFromAssistantText(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/im);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    }
    throw new Error("Could not parse JSON object from model output");
  }
}
