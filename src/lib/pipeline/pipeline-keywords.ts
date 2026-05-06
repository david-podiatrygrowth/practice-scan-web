import type { PipelineState } from "@/lib/pipeline/types";

/**
 * Keyword order for the practice scan: explicit `scans.keywords` when present,
 * otherwise the order returned from Local Falcon retrieval.
 */
export function keywordsInPipelineOrder(state: PipelineState): string[] {
  const planned = state.scans?.keywords;
  if (planned?.length) return planned;
  return state.retrieveScans?.reports.map((r) => r.keyword) ?? [];
}
