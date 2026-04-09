/**
 * Shared types for the client-orchestrated chunked pipeline.
 * Replace stub fields as you wire LocalFalcon, Firecrawl, and docx.
 */

export type PipelineStepId =
  | "resolve"
  | "analyze-gbp"
  | "scans"
  | "retrieve-scans"
  | "analyze-scan"
  | "website"
  | "analyze-website"
  | "demographics"
  | "render";

export type PipelineInput = {
  practiceName: string;
  /** If omitted, server steps may compute radius (see SKILL). */
  radiusMi?: number;
  /** Optional — narrows search / report copy (e.g. Local Falcon proximity). */
  city?: string;
  /** Optional — US state or region (e.g. OH). */
  state?: string;
};

export type ResolveResult = {
  placeId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  websiteUrl: string | null;
  rating?: number;
  reviewCount?: number;
};

/** Google Business Profile analysis (listing quality, categories, etc.). Markdown. */
export type AnalyzeGbpResult = {
  summary: string;
  /** Caveats e.g. thin Local Falcon payload */
  queryNotes?: string;
};

export type ScanReportStub = {
  keyword: string;
  reportKey?: string;
  /** Stub metrics — replace with real LocalFalcon fields */
  arp?: number;
  solv?: number;
  gridImageUrl?: string;
};

export type ScansResult = {
  scanRadiusMi: number;
  keywords: string[];
  reports: ScanReportStub[];
};

/** Full scan report JSON per keyword after POST /v1/reports/{report_key}/ */
export type RetrievedScanReport = {
  reportKey: string;
  keyword: string;
  payload: Record<string, unknown>;
};

export type RetrieveScansResult = {
  reports: RetrievedScanReport[];
};

export type AnalyzeScanResult = {
  summary: string;
};

/** How the website step obtained content (Firecrawl vs plain `fetch`). */
export type WebsiteScrapeMetrics = {
  source: "firecrawl" | "fetch";
  /** End-to-end time for this step’s winning path (ms) */
  totalMs: number;
  firecrawlMs?: number;
  fetchMs?: number;
  httpStatus?: number;
  note?: string;
};

export type WebsiteResult = {
  url: string;
  markdown: string;
  scrape?: WebsiteScrapeMetrics;
};

export type AnalyzeWebsiteResult = {
  summary: string;
};

export type DemographicsResult = {
  /** Markdown — Demographic Opportunity section and related analysis */
  summary: string;
  /** e.g. methodology caveats, verification reminders */
  queryNotes?: string;
};

export type RenderResult = {
  fileName: string;
  mimeType: string;
  /** Base64-encoded file bytes for download */
  base64: string;
  /** Set when `BLOB_READ_WRITE_TOKEN` is configured (Vercel Blob). */
  downloadUrl?: string;
};

export type PipelineState = {
  input: PipelineInput;
  resolve?: ResolveResult;
  analyzeGbp?: AnalyzeGbpResult;
  scans?: ScansResult;
  retrieveScans?: RetrieveScansResult;
  analyzeScan?: AnalyzeScanResult;
  website?: WebsiteResult;
  analyzeWebsite?: AnalyzeWebsiteResult;
  demographics?: DemographicsResult;
  render?: RenderResult;
};

export type PipelineStepSuccess = {
  ok: true;
  step: PipelineStepId;
  data:
    | ResolveResult
    | AnalyzeGbpResult
    | ScansResult
    | RetrieveScansResult
    | AnalyzeScanResult
    | WebsiteResult
    | AnalyzeWebsiteResult
    | DemographicsResult
    | RenderResult;
};

export type PipelineStepFailure = {
  ok: false;
  step: PipelineStepId;
  error: string;
  code?: string;
};

export type PipelineStepResponse = PipelineStepSuccess | PipelineStepFailure;

export const PIPELINE_STEPS: readonly PipelineStepId[] = [
  "resolve",
  "scans",
  "retrieve-scans",
  "analyze-gbp",
  "analyze-scan",
  "website",
  "analyze-website",
  "demographics",
  "render",
] as const;
