import { NextResponse } from "next/server";
import type { PipelineState } from "@/lib/pipeline/types";
import { fail } from "@/lib/pipeline/server-json";

/**
 * Chunk 1: find practice (LocalFalcon / search). Stub — replace with real MCP/API calls.
 */
export async function POST(req: Request) {
  let body: { state?: PipelineState };
  try {
    body = await req.json();
  } catch {
    return fail("resolve", "Request body must be JSON", "invalid_json");
  }

  const state = body.state;
  if (!state?.input?.practiceName?.trim()) {
    return fail("resolve", "input.practiceName is required", "missing_input");
  }

  const name = state.input.practiceName.trim();

  return NextResponse.json({
    ok: true,
    step: "resolve" as const,
    data: {
      placeId: `stub_place_${name.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 24)}`,
      name,
      formattedAddress: "123 Example St, Example City, ST 12345 (stub)",
      lat: 40.7128,
      lng: -74.006,
      websiteUrl: "https://example.com",
      rating: 4.7,
      reviewCount: 120,
    },
  });
}
