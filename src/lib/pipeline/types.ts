/**
 * Shared types for the client-orchestrated chunked pipeline.
 * Replace stub fields as you wire LocalFalcon, Firecrawl, and docx.
 */

export type PipelineStepId =
  | "resolve"
  | "scans"
  | "retrieve-reports"
  | "analyze-scan"
  | "website"
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

export type RetrieveReportsResult = {
  reports: RetrievedScanReport[];
};

export type AnalyzeScanResult = {
  summary: string;
};

export type WebsiteResult = {
  url: string;
  markdown: string;
};

export type DemographicsResult = {
  summary: string;
  queryNotes?: string;
};

export type RenderResult = {
  fileName: string;
  mimeType: string;
  /** Base64-encoded file bytes for download */
  base64: string;
};

export type PipelineState = {
  input: PipelineInput;
  resolve?: ResolveResult;
  scans?: ScansResult;
  retrieveReports?: RetrieveReportsResult;
  analyzeScan?: AnalyzeScanResult;
  website?: WebsiteResult;
  demographics?: DemographicsResult;
  render?: RenderResult;
};

export type PipelineStepSuccess = {
  ok: true;
  step: PipelineStepId;
  data:
    | ResolveResult
    | ScansResult
    | RetrieveReportsResult
    | AnalyzeScanResult
    | WebsiteResult
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
  "retrieve-reports",
  "analyze-scan",
  "website",
  "demographics",
  "render",
] as const;
