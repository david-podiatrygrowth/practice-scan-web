import type {
  AnalyzeScanResult,
  PipelineState,
  PipelineStepId,
  RadiusResult,
  ResolveResult,
  AnalyzeGbpResult,
  RetrieveScansResult,
  ScansResult,
  WebsiteResult,
  AnalyzeWebsiteResult,
  DemographicsResult,
  RenderResult,
} from "./types";

export function mergeStepData(
  state: PipelineState,
  step: PipelineStepId,
  data:
    | ResolveResult
    | RadiusResult
    | AnalyzeGbpResult
    | ScansResult
    | RetrieveScansResult
    | AnalyzeScanResult
    | WebsiteResult
    | AnalyzeWebsiteResult
    | DemographicsResult
    | RenderResult,
): PipelineState {
  switch (step) {
    case "resolve":
      return { ...state, resolve: data as ResolveResult };
    case "radius":
      return { ...state, radius: data as RadiusResult };
    case "analyze-gbp":
      return { ...state, analyzeGbp: data as AnalyzeGbpResult };
    case "scans":
      return { ...state, scans: data as ScansResult };
    case "retrieve-scans":
      return { ...state, retrieveScans: data as RetrieveScansResult };
    case "analyze-scan":
      return { ...state, analyzeScan: data as AnalyzeScanResult };
    case "website":
      return { ...state, website: data as WebsiteResult };
    case "analyze-website":
      return { ...state, analyzeWebsite: data as AnalyzeWebsiteResult };
    case "demographics":
      return { ...state, demographics: data as DemographicsResult };
    case "render":
      return { ...state, render: data as RenderResult };
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}
