import type {
  AnalyzeScanResult,
  PipelineState,
  PipelineStepId,
  ResolveResult,
  RetrieveReportsResult,
  ScansResult,
  WebsiteResult,
  DemographicsResult,
  RenderResult,
} from "./types";

export function mergeStepData(
  state: PipelineState,
  step: PipelineStepId,
  data:
    | ResolveResult
    | ScansResult
    | RetrieveReportsResult
    | AnalyzeScanResult
    | WebsiteResult
    | DemographicsResult
    | RenderResult,
): PipelineState {
  switch (step) {
    case "resolve":
      return { ...state, resolve: data as ResolveResult };
    case "scans":
      return { ...state, scans: data as ScansResult };
    case "retrieve-reports":
      return { ...state, retrieveReports: data as RetrieveReportsResult };
    case "analyze-scan":
      return { ...state, analyzeScan: data as AnalyzeScanResult };
    case "website":
      return { ...state, website: data as WebsiteResult };
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
