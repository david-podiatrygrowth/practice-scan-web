/**
 * Shared types for the client-orchestrated chunked pipeline.
 * Replace stub fields as you wire LocalFalcon, Firecrawl, and docx.
 */

export type PipelineStepId =
  | "resolve"
  | "scans"
  | "website"
  | "demographics"
  | "render";

export type PipelineInput = {
  practiceName: string;
  /** If omitted, server steps may compute radius (see SKILL). */
  radiusMi?: number;
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
  "website",
  "demographics",
  "render",
] as const;
