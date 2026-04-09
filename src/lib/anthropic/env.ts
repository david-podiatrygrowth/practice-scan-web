import { AnthropicClient } from "./client";

const KEY = "ANTHROPIC_API_KEY";

/**
 * Read API key from the environment (server-side only).
 */
export function getAnthropicApiKey(): string {
  const key = process.env[KEY]?.trim();
  if (!key) {
    throw new Error(
      `${KEY} is not set. Add it to .env.local or your host's environment.`,
    );
  }
  return key;
}

export function createAnthropicClient(): AnthropicClient {
  return new AnthropicClient(getAnthropicApiKey());
}
