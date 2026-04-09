import { FirecrawlClient } from "./client";

const KEY = "FIRECRAWL_API_KEY";

/**
 * Read API key from the environment (server-side only).
 * Keys typically look like `fc-...`.
 */
export function getFirecrawlApiKey(): string {
  const key = process.env[KEY]?.trim();
  if (!key) {
    throw new Error(
      `${KEY} is not set. Add it to .env.local or your host's environment.`,
    );
  }
  return key;
}

export function createFirecrawlClient(): FirecrawlClient {
  return new FirecrawlClient(getFirecrawlApiKey());
}
