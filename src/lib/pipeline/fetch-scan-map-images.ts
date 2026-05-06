import { keywordsInPipelineOrder } from "@/lib/pipeline/pipeline-keywords";
import type {
  PipelineState,
  RetrieveScansResult,
  ScansResult,
} from "@/lib/pipeline/types";

const LF_STATIC_IMAGE_BASE = "https://lf-static-v2.localfalcon.com/image/";

function keywordKey(keyword: string): string {
  return keyword.trim().toLowerCase();
}

function stubForKeyword(
  scans: ScansResult | undefined,
  keyword: string,
) {
  const k = keywordKey(keyword);
  return scans?.reports?.find((r) => keywordKey(r.keyword) === k);
}

function retrievalForKeyword(
  retrieved: RetrieveScansResult | undefined,
  keyword: string,
) {
  const k = keywordKey(keyword);
  return retrieved?.reports.find((r) => keywordKey(r.keyword) === k);
}

function trimHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

/**
 * Resolved in order: full report JSON (`image`, `heatmap`), scans-step preview URL,
 * then Local Falcon static image URL using `reportKey`.
 */
export function keywordMapImageUrl(
  state: PipelineState,
  keyword: string,
): string | undefined {
  const report = retrievalForKeyword(state.retrieveScans, keyword);
  const stub = stubForKeyword(state.scans, keyword);
  const payload = report?.payload ?? {};

  const fromPayload =
    trimHttpUrl(payload.image) ?? trimHttpUrl(payload.heatmap);
  if (fromPayload) return fromPayload;

  const fromStub = trimHttpUrl(stub?.gridImageUrl);
  if (fromStub) return fromStub;

  const reportKey = report?.reportKey?.trim() ?? stub?.reportKey?.trim();
  return reportKey ? `${LF_STATIC_IMAGE_BASE}${reportKey}` : undefined;
}

export async function fetchMapPng(url: string): Promise<Buffer | null> {
  const preview = url.length > 120 ? `${url.slice(0, 120)}…` : url;

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      console.warn(`[fetchMapPng] HTTP ${res.status}: ${preview}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[fetchMapPng] ${msg}: ${preview}`);
    return null;
  }
}

/** Download map images for keyword 1 and 2 (pipeline order); missing URLs yield `null`. */
export async function fetchFirstTwoKeywordMapBuffers(
  state: PipelineState,
): Promise<{ kw1: Buffer | null; kw2: Buffer | null }> {
  const [kw1Raw, kw2Raw] = keywordsInPipelineOrder(state);

  const url1 =
    kw1Raw?.trim() ? keywordMapImageUrl(state, kw1Raw) : undefined;
  const url2 =
    kw2Raw?.trim() ? keywordMapImageUrl(state, kw2Raw) : undefined;

  const [kw1, kw2] = await Promise.all([
    url1 ? fetchMapPng(url1) : Promise.resolve(null),
    url2 ? fetchMapPng(url2) : Promise.resolve(null),
  ]);

  return { kw1, kw2 };
}
