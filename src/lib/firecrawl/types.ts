/**
 * Firecrawl API v2 — subset of request/response shapes.
 * @see https://docs.firecrawl.dev/api-reference/introduction
 */

export type FirecrawlScrapeParams = {
  url: string;
  /** Default in client: markdown for pipeline text */
  formats?: unknown;
  onlyMainContent?: boolean;
  timeout?: number;
  zeroDataRetention?: boolean;
} & Record<string, unknown>;

export type FirecrawlScrapeData = {
  markdown?: string;
  html?: string;
  rawHtml?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
  links?: string[];
  screenshot?: string | null;
  [key: string]: unknown;
};

export type FirecrawlScrapeResponse = {
  success: boolean;
  data?: FirecrawlScrapeData;
  error?: string;
};

export type FirecrawlMapParams = {
  url: string;
  search?: string;
  sitemap?: "skip" | "include" | "only";
  includeSubdomains?: boolean;
  ignoreQueryParameters?: boolean;
  ignoreCache?: boolean;
  limit?: number;
  timeout?: number;
  location?: { country?: string; languages?: string[] };
} & Record<string, unknown>;

export type FirecrawlMapLink = {
  url: string;
  title?: string;
  description?: string;
};

export type FirecrawlMapResponse = {
  success: boolean;
  links?: FirecrawlMapLink[];
  error?: string;
};
