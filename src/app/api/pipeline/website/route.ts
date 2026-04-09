import { NextResponse } from "next/server";
import { scrapeSiteForPipeline } from "@/lib/website/scrape-site";
import type { PipelineState } from "@/lib/pipeline/types";
import { fail } from "@/lib/pipeline/server-json";

/**
 * Scrape practice website: Firecrawl markdown first; if unavailable or CSS-shell on fetch, retry Firecrawl or plain text from HTTP.
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

  const rawUrl = state.resolve.websiteUrl?.trim();
  if (!rawUrl) {
    return fail(
      "website",
      "No website URL on the resolved listing. Add a site in Google Business Profile or run resolve with a practice that has a website.",
      "missing_website_url",
    );
  }

  let targetUrl: string;
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    targetUrl = u.toString();
  } catch {
    return fail("website", "Website URL is not valid", "invalid_website_url");
  }

  try {
    const { url, markdown, scrape } = await scrapeSiteForPipeline(targetUrl);
    return NextResponse.json({
      ok: true,
      step: "website" as const,
      data: {
        url,
        markdown,
        scrape,
      },
    });
  } catch (e) {
    console.error("[website] scrape error:", e);
    return fail(
      "website",
      e instanceof Error ? e.message : String(e),
      "scrape_error",
      500,
    );
  }
}
