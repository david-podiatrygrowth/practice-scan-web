import type { RetrievedScanReport } from "@/lib/pipeline/types";

/** Local Falcon static grid PNG URL from report payload or constructed from report_key. */
export function gridImageUrlFromPayload(payload: Record<string, unknown>): string | null {
  const img = payload.image;
  if (typeof img === "string" && /^https?:\/\//i.test(img.trim())) {
    return img.trim();
  }
  const rk = payload.report_key;
  if (typeof rk === "string" && rk.trim()) {
    return `https://lf-static-v2.localfalcon.com/image/${rk.trim()}`;
  }
  return null;
}

export async function fetchGridImageBuffers(
  reports: RetrievedScanReport[],
): Promise<(Uint8Array | null)[]> {
  return Promise.all(
    reports.map(async (r) => {
      const url = gridImageUrlFromPayload(r.payload);
      if (!url) return null;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
      } catch {
        return null;
      }
    }),
  );
}
