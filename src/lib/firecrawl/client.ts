import { FirecrawlApiError } from "./errors";
import type {
  FirecrawlMapParams,
  FirecrawlMapResponse,
  FirecrawlScrapeParams,
  FirecrawlScrapeResponse,
} from "./types";

const DEFAULT_BASE = "https://api.firecrawl.dev/v2";

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function errorMessage(json: unknown, fallback: string): string {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (typeof o.error === "string" && o.error) return o.error;
    if (typeof o.message === "string" && o.message) return o.message;
  }
  return fallback;
}

/**
 * REST client for Firecrawl API v2. Server-side only — keep {@link FIRECRAWL_API_KEY} out of bundles.
 *
 * @see https://docs.firecrawl.dev/api-reference/introduction
 */
export class FirecrawlClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE,
  ) {}

  private async postJson<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const endpoint = `${this.baseUrl}${path}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await parseJson(res)) as Record<string, unknown> | null;

    if (!res.ok) {
      throw new FirecrawlApiError(
        errorMessage(json, `HTTP ${res.status}`),
        {
          httpStatus: res.status,
          endpoint,
          code: typeof json?.code === "string" ? json.code : undefined,
        },
      );
    }

    if (json && json.success === false) {
      throw new FirecrawlApiError(
        errorMessage(json, "Firecrawl returned success: false"),
        {
          httpStatus: res.status,
          endpoint,
          code: typeof json.code === "string" ? json.code : undefined,
        },
      );
    }

    return json as T;
  }

  /**
   * POST /v2/scrape — single-page scrape (markdown, html, etc.).
   */
  async scrape(
    params: FirecrawlScrapeParams,
  ): Promise<FirecrawlScrapeResponse> {
    const { url, formats, ...rest } = params;
    return this.postJson<FirecrawlScrapeResponse>("/scrape", {
      url,
      formats: formats ?? ["markdown"],
      ...rest,
    });
  }

  /**
   * POST /v2/map — list URLs for a site.
   */
  async map(params: FirecrawlMapParams): Promise<FirecrawlMapResponse> {
    return this.postJson<FirecrawlMapResponse>("/map", {
      ...params,
    });
  }
}

export { DEFAULT_BASE };
