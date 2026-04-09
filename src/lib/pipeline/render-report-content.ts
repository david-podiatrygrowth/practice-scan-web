/**
 * Claude returns this JSON; the render step builds a .docx from it + fetched grid images.
 */

export type ReportItem = {
  title: string;
  body: string;
};

export type KeywordSectionContent = {
  keyword: string;
  statsLine: string;
  analysis: string;
};

export type ScoreSummaryRow = {
  category: string;
  score: number;
  status: string;
};

export type IncomeRow = {
  neighborhood: string;
  income: string;
  /** Bold / highlight as practice row */
  highlightPracticeRow?: boolean;
};

export type PracticeInfoFields = {
  practiceName: string;
  doctorName: string;
  website: string;
  locations: string;
  reportDate: string;
};

export type ReportDocumentContent = {
  practiceName: string;
  cityStateLine: string;
  areaDescription: string;
  visibilityScore: number;
  scoreLabel: string;
  strengths: ReportItem[];
  problems: ReportItem[];
  scanIntro: string;
  legendGreen: string;
  legendYellow: string;
  legendRed: string;
  keywordSections: KeywordSectionContent[];
  bottomLine: string;
  practiceInfo: PracticeInfoFields;
  scoreSummary: ScoreSummaryRow[];
  demographicsIntro: string;
  incomeRows: IncomeRow[];
  demographicsAnalysis: string;
  generalObservations: ReportItem[];
  criticalObservations: ReportItem[];
  ctaHeadline: string;
  ctaContactLine: string;
  ctaScheduleLine: string;
};

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNum(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asBool(v: unknown): boolean {
  return v === true;
}

function asItems(v: unknown): ReportItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((row) => ({
    title: asStr(
      row && typeof row === "object" && "title" in row
        ? (row as { title?: unknown }).title
        : "",
    ),
    body: asStr(
      row && typeof row === "object" && "body" in row
        ? (row as { body?: unknown }).body
        : "",
    ),
  }));
}

function asKeywordSections(v: unknown): KeywordSectionContent[] {
  if (!Array.isArray(v)) return [];
  return v.map((row) => ({
    keyword: asStr(
      row && typeof row === "object" && "keyword" in row
        ? (row as { keyword?: unknown }).keyword
        : "",
    ),
    statsLine: asStr(
      row && typeof row === "object" && "statsLine" in row
        ? (row as { statsLine?: unknown }).statsLine
        : "",
    ),
    analysis: asStr(
      row && typeof row === "object" && "analysis" in row
        ? (row as { analysis?: unknown }).analysis
        : "",
    ),
  }));
}

function asScoreRows(v: unknown): ScoreSummaryRow[] {
  if (!Array.isArray(v)) return [];
  return v.map((row) => ({
    category: asStr(
      row && typeof row === "object" && "category" in row
        ? (row as { category?: unknown }).category
        : "",
    ),
    score: asNum(
      row && typeof row === "object" && "score" in row
        ? (row as { score?: unknown }).score
        : 0,
    ),
    status: asStr(
      row && typeof row === "object" && "status" in row
        ? (row as { status?: unknown }).status
        : "",
    ),
  }));
}

function asIncomeRows(v: unknown): IncomeRow[] {
  if (!Array.isArray(v)) return [];
  return v.map((row) => ({
    neighborhood: asStr(
      row && typeof row === "object" && "neighborhood" in row
        ? (row as { neighborhood?: unknown }).neighborhood
        : "",
    ),
    income: asStr(
      row && typeof row === "object" && "income" in row
        ? (row as { income?: unknown }).income
        : "",
    ),
    highlightPracticeRow: asBool(
      row && typeof row === "object" && "highlightPracticeRow" in row
        ? (row as { highlightPracticeRow?: unknown }).highlightPracticeRow
        : false,
    ),
  }));
}

function asPracticeInfo(v: unknown): PracticeInfoFields {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    practiceName: asStr(o.practiceName),
    doctorName: asStr(o.doctorName),
    website: asStr(o.website),
    locations: asStr(o.locations),
    reportDate: asStr(o.reportDate),
  };
}

export function parseReportDocumentJson(raw: unknown): ReportDocumentContent {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    practiceName: asStr(o.practiceName),
    cityStateLine: asStr(o.cityStateLine),
    areaDescription: asStr(o.areaDescription),
    visibilityScore: asNum(o.visibilityScore),
    scoreLabel: asStr(o.scoreLabel),
    strengths: asItems(o.strengths),
    problems: asItems(o.problems),
    scanIntro: asStr(o.scanIntro),
    legendGreen: asStr(o.legendGreen),
    legendYellow: asStr(o.legendYellow),
    legendRed: asStr(o.legendRed),
    keywordSections: asKeywordSections(o.keywordSections),
    bottomLine: asStr(o.bottomLine),
    practiceInfo: asPracticeInfo(o.practiceInfo),
    scoreSummary: asScoreRows(o.scoreSummary),
    demographicsIntro: asStr(o.demographicsIntro),
    incomeRows: asIncomeRows(o.incomeRows),
    demographicsAnalysis: asStr(o.demographicsAnalysis),
    generalObservations: asItems(o.generalObservations),
    criticalObservations: asItems(o.criticalObservations),
    ctaHeadline: asStr(o.ctaHeadline),
    ctaContactLine: asStr(o.ctaContactLine),
    ctaScheduleLine: asStr(o.ctaScheduleLine),
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
