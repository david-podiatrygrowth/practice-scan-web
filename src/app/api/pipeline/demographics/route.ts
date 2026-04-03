import { NextResponse } from "next/server";
import type { PipelineState } from "@/lib/pipeline/types";
import { fail } from "@/lib/pipeline/server-json";

/**
 * Chunk 4: demographics / web research. Stub summary.
 */
export async function POST(req: Request) {
  let body: { state?: PipelineState };
  try {
    body = await req.json();
  } catch {
    return fail("demographics", "Request body must be JSON", "invalid_json");
  }

  const state = body.state;
  if (!state?.resolve) {
    return fail(
      "demographics",
      "resolve step must complete first",
      "missing_resolve",
    );
  }

  return NextResponse.json({
    ok: true,
    step: "demographics" as const,
    data: {
      summary: `Stub demographic narrative for ${state.resolve.formattedAddress}. Replace with web_search + Census-driven copy per SKILL.`,
      queryNotes: "optional",
    },
  });
}
