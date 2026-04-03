import { NextResponse } from "next/server";
import type { PipelineState } from "@/lib/pipeline/types";
import { fail } from "@/lib/pipeline/server-json";

/**
 * Chunk 3: Firecrawl (or fallback) scrape. Stub markdown.
 */
export async function POST(req: Request) {
  let body: { state?: PipelineState };
  try {
    body = await req.json();
  } catch {
    return fail("website", "Request body must be JSON", "invalid_json");
  }

  const state = body.state;
  if (!state?.resolve) {
    return fail("website", "resolve step must complete first", "missing_resolve");
  }

  const url = state.resolve.websiteUrl ?? "https://example.com";

  return NextResponse.json({
    ok: true,
    step: "website" as const,
    data: {
      url,
      markdown: `# Website (stub)\n\nScraped content for **${state.resolve.name}** would appear here.\n\nReplace this route with Firecrawl output.`,
    },
  });
}
