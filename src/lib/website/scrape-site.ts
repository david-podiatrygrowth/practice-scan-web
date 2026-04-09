import { createFirecrawlClient } from "@/lib/firecrawl";
import { FirecrawlApiError } from "@/lib/firecrawl/errors";
import type { WebsiteScrapeMetrics } from "@/lib/pipeline/types";

const FETCH_UA =
  "Mozilla/5.0 (compatible; PracticeScanPipeline/1.0; +https://www.firecrawl.dev)";

/** Rough HTML → text when Firecrawl is unavailable. */
function htmlToPlainText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = stripped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 80_000 ? `${text.slice(0, 80_000)}… [truncated]` : text;
}

/**
 * Detect WordPress/Divi-style responses that are mostly asset references and little readable copy
 * (similar to what simple HTTP fetches return for some sites).
 */
export function isLikelyCssJsShellHtml(html: string): boolean {
  if (html.length < 400) return false;
  const stylesheetRefs =
    (html.match(/rel\s*=\s*["']stylesheet["']/gi) ?? []).length;
  const cssHints = (html.match(/["'][^"']+\.css(\?[^"']*)?["']/gi) ?? []).length;
  const withoutAssets = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<link[^>]+>/gi, " ");
  const roughText = withoutAssets.replace(/<[^>]+>/g, " ");
  const wordish = roughText
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-zA-Z]{4,}/.test(w)).length;

  return (stylesheetRefs >= 3 || cssHints >= 6) && wordish < 100;
}

async function fetchUrlWithTiming(url: string): Promise<{
  ms: number;
  status: number;
  body: string;
}> {
  const t0 = Date.now();
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": FETCH_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const body = await res.text();
  return { ms: Date.now() - t0, status: res.status, body };
}

async function runFirecrawl(
  url: string,
): Promise<{ ms: number; markdown: string | null; error?: string }> {
  const t0 = Date.now();
  try {
    const fc = createFirecrawlClient();
    const res = await fc.scrape({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    });
    const ms = Date.now() - t0;
    const md = res.data?.markdown?.trim();
    return { ms, markdown: md || null };
  } catch (e) {
    const ms = Date.now() - t0;
    const msg =
      e instanceof FirecrawlApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : String(e);
    console.warn("[scrape-site] Firecrawl:", msg);
    return { ms, markdown: null, error: msg };
  }
}

export type ScrapeSiteOutcome = {
  url: string;
  markdown: string;
  scrape: WebsiteScrapeMetrics;
};

/**
 * Prefer Firecrawl (markdown). On failure or missing key, `fetch` the URL (same role as `web_fetch`).
 * If the fetch body looks like a CSS/JS shell and Firecrawl is configured, retry Firecrawl once.
 */
export async function scrapeSiteForPipeline(canonicalUrl: string): Promise<ScrapeSiteOutcome> {
  const url = canonicalUrl.trim();
  const hasFc = Boolean(process.env.FIRECRAWL_API_KEY?.trim());

  if (hasFc) {
    const primary = await runFirecrawl(url);
    if (primary.markdown) {
      return {
        url,
        markdown: primary.markdown,
        scrape: {
          source: "firecrawl",
          totalMs: primary.ms,
          firecrawlMs: primary.ms,
        },
      };
    }

    let fetchMs: number;
    let httpStatus: number;
    let fetchBody: string;
    try {
      const f = await fetchUrlWithTiming(url);
      fetchMs = f.ms;
      httpStatus = f.status;
      fetchBody = f.body;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        url,
        markdown: `# Website fetch failed\n\n**Firecrawl:** ${primary.error ?? "no markdown"}\n\n**HTTP fetch:** ${msg}\n\nURL: ${url}`,
        scrape: {
          source: "fetch",
          totalMs: primary.ms,
          firecrawlMs: primary.ms,
          note: `Firecrawl failed (${primary.error ?? "empty"}); HTTP fetch failed (${msg}).`,
        },
      };
    }

    if (isLikelyCssJsShellHtml(fetchBody)) {
      const retry = await runFirecrawl(url);
      if (retry.markdown) {
        return {
          url,
          markdown: retry.markdown,
          scrape: {
            source: "firecrawl",
            totalMs: primary.ms + fetchMs + retry.ms,
            firecrawlMs: primary.ms + retry.ms,
            fetchMs,
            httpStatus,
            note:
              "Plain HTTP fetch looked like stylesheets/scripts with little readable text; used Firecrawl for content.",
          },
        };
      }
    }

    const plain = htmlToPlainText(fetchBody);
    const shell = isLikelyCssJsShellHtml(fetchBody);
    return {
      url,
      markdown: [
        "# Website (HTTP fetch)",
        "",
        `Timing: Firecrawl primary ${primary.ms}ms (${primary.error ? `error: ${primary.error}` : "no markdown"}); HTTP fetch ${fetchMs}ms (status ${httpStatus}).`,
        "",
        shell
          ? "_HTTP body still looked CSS/JS-heavy after Firecrawl retry._"
          : null,
        "",
        plain || "_No extractable text._",
      ]
        .filter((line) => line != null)
        .join("\n"),
      scrape: {
        source: "fetch",
        totalMs: fetchMs,
        fetchMs,
        firecrawlMs: primary.ms,
        httpStatus,
        note: [
          primary.error ? `Firecrawl: ${primary.error}` : "Firecrawl returned no markdown.",
          shell ? "HTTP body looked CSS-heavy; Firecrawl retry had no markdown." : null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    };
  }

  // No Firecrawl key — HTTP fetch only (web_fetch–style)
  try {
    const { ms: fetchMs, status: httpStatus, body } = await fetchUrlWithTiming(url);
    const shell = isLikelyCssJsShellHtml(body);
    const plain = htmlToPlainText(body);

    if (shell) {
      return {
        url,
        markdown: [
          "# Website (HTTP fetch only)",
          "",
          `Fetched in ${fetchMs}ms (HTTP ${httpStatus}).`,
          "",
          "This response looks like mostly stylesheets and scripts with little readable text — common for WordPress/Divi when using a simple HTTP fetch.",
          "",
          "Set **FIRECRAWL_API_KEY** for a proper markdown scrape.",
          "",
          "---",
          "",
          plain || "_No extractable text._",
        ].join("\n"),
        scrape: {
          source: "fetch",
          totalMs: fetchMs,
          fetchMs,
          httpStatus,
          note:
            "Fetch resembled a CSS/JS-heavy shell; Firecrawl not configured.",
        },
      };
    }

    return {
      url,
      markdown: [
        "# Website (HTTP fetch)",
        "",
        `Fetched in ${fetchMs}ms (HTTP ${httpStatus}).`,
        "",
        plain || "_No extractable text._",
      ].join("\n"),
      scrape: {
        source: "fetch",
        totalMs: fetchMs,
        fetchMs,
        httpStatus,
        note: "No FIRECRAWL_API_KEY; used HTTP fetch only.",
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      url,
      markdown: `# Website fetch failed\n\n${msg}\n\nURL: ${url}`,
      scrape: {
        source: "fetch",
        totalMs: 0,
        note: `HTTP fetch failed (${msg}). Set FIRECRAWL_API_KEY for Firecrawl.`,
      },
    };
  }
}
