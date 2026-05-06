import type { PipelineState } from "@/lib/pipeline/types";

const LF_STATIC_IMAGE = "https://lf-static-v2.localfalcon.com/image/";

function scanStubForKeyword(
  state: PipelineState,
  keyword: string,
):
  | { reportKey?: string; gridImageUrl?: string }
  | undefined {
  const k = keyword.trim().toLowerCase();
  return state.scans?.reports?.find(
    (r) => r.keyword.trim().toLowerCase() === k,
  );
}

function retrievedReportForKeyword(
  state: PipelineState,
  keyword: string,
) {
  const k = keyword.trim().toLowerCase();
  return state.retrieveScans?.reports.find(
    (r) => r.keyword.trim().toLowerCase() === k,
  );
}

/**
 * Prefer Local Falcon CDN URL from poll payload (`image`), then scans-step URL, then derived static PNG URL.
 */
export function keywordMapImageUrl(
  state: PipelineState,
  keyword: string,
): string | undefined {
  const retrieved = retrievedReportForKeyword(state, keyword);
  const stub = scanStubForKeyword(state, keyword);
  const payload = retrieved?.payload ?? {};

  const fromPayload =
    typeof payload.image === "string"
      ? payload.image.trim()
      : typeof payload.heatmap === "string"
        ? (payload.heatmap as string).trim()
        : undefined;
  if (
    fromPayload &&
    /^https?:\/\//i.test(fromPayload)
  ) {
    return fromPayload;
  }

  const fromStub = stub?.gridImageUrl?.trim();
  if (fromStub && /^https?:\/\//i.test(fromStub)) {
    return fromStub;
  }

  const key = retrieved?.reportKey?.trim() ?? stub?.reportKey?.trim();
  if (key) {
    return `${LF_STATIC_IMAGE}${key}`;
  }

  return undefined;
}

export async function fetchMapPng(
  url: string,
): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      console.warn(
        `[fetchMapPng] HTTP ${res.status} for ${url.slice(0, 120)}…`,
      );
      return null;
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    console.warn(
      `[fetchMapPng] ${e instanceof Error ? e.message : String(e)} — ${url.slice(0, 120)}…`,
    );
    return null;
  }
}

/** First two keywords in pipeline order → map PNGs (parallel fetch). */
export async function fetchFirstTwoKeywordMapBuffers(
  state: PipelineState,
): Promise<{ kw1: Buffer | null; kw2: Buffer | null }> {
  const keywords =
    state.scans?.keywords?.length && state.scans.keywords.length > 0
      ? state.scans.keywords
      : (state.retrieveScans?.reports.map((r) => r.keyword) ?? []);

  const u1 =
    keywords[0]?.trim() ? keywordMapImageUrl(state, keywords[0]) : undefined;
  const u2 =
    keywords[1]?.trim() ? keywordMapImageUrl(state, keywords[1]) : undefined;

  const [buf1, buf2] = await Promise.all([
    u1 ? fetchMapPng(u1) : Promise.resolve(null),
    u2 ? fetchMapPng(u2) : Promise.resolve(null),
  ]);

  return { kw1: buf1, kw2: buf2 };
}
