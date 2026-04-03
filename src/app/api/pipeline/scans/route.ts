import { NextResponse } from "next/server";
import type { PipelineState } from "@/lib/pipeline/types";
import { fail } from "@/lib/pipeline/server-json";

/**
 * Chunk 2: list/reuse or run LocalFalcon scans per keyword. Stub.
 */
export async function POST(req: Request) {
  let body: { state?: PipelineState };
  try {
    body = await req.json();
  } catch {
    return fail("scans", "Request body must be JSON", "invalid_json");
  }

  const state = body.state;
  if (!state?.resolve) {
    return fail("scans", "resolve step must complete first", "missing_resolve");
  }

  const scanRadiusMi =
    state.input.radiusMi ??
    /* stub fallback — replace with Census / CITY_RADIUS logic */
    5;

  const keywords = ["podiatrist", "foot doctor"];

  return NextResponse.json({
    ok: true,
    step: "scans" as const,
    data: {
      scanRadiusMi,
      keywords,
      reports: keywords.map((keyword) => ({
        keyword,
        reportKey: `stub_${keyword}`,
        arp: 8.2,
        solv: 0.14,
        gridImageUrl: undefined,
      })),
    },
  });
}
