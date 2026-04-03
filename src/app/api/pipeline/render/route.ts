import { NextResponse } from "next/server";
import type { PipelineState } from "@/lib/pipeline/types";
import { fail } from "@/lib/pipeline/server-json";

/**
 * Chunk 5: assemble .docx (docx-js). Stub plain-text file to prove download wiring.
 */
export async function POST(req: Request) {
  let body: { state?: PipelineState };
  try {
    body = await req.json();
  } catch {
    return fail("render", "Request body must be JSON", "invalid_json");
  }

  const state = body.state;
  if (
    !state?.resolve ||
    !state.scans ||
    !state.website ||
    !state.demographics
  ) {
    return fail(
      "render",
      "resolve, scans, website, and demographics must complete first",
      "missing_prereqs",
    );
  }

  const text = [
    "Practice Visibility Scan (stub export)",
    "",
    `Practice: ${state.resolve.name}`,
    `Radius (mi): ${state.scans.scanRadiusMi}`,
    `Keywords: ${state.scans.keywords.join(", ")}`,
    "",
    "--- Demographics (stub) ---",
    state.demographics.summary,
    "",
    "--- Website excerpt ---",
    state.website.markdown.slice(0, 800),
  ].join("\n");

  const base64 = Buffer.from(text, "utf8").toString("base64");

  return NextResponse.json({
    ok: true,
    step: "render" as const,
    data: {
      fileName: "practice-visibility-scan-stub.txt",
      mimeType: "text/plain",
      base64,
    },
  });
}
