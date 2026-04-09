import { AnthropicApiError } from "./errors";
import type {
  AnthropicErrorResponse,
  MessagesCreateParams,
  MessagesResponse,
} from "./types";

const DEFAULT_BASE = "https://api.anthropic.com";
/** Required header per Anthropic API docs */
const DEFAULT_VERSION = "2023-06-01";

function parseErrorBody(json: unknown): { type?: string; message?: string } | undefined {
  if (!json || typeof json !== "object") return undefined;
  const o = json as AnthropicErrorResponse;
  const e = o.error;
  if (!e || typeof e !== "object") return undefined;
  return {
    type: typeof e.type === "string" ? e.type : undefined,
    message: typeof e.message === "string" ? e.message : undefined,
  };
}

/**
 * Minimal REST client for Anthropic — POST /v1/messages only.
 * Use only on the server; keep the API key out of client bundles.
 */
export class AnthropicClient {
  constructor(
    private readonly apiKey: string,
    private readonly options?: {
      baseUrl?: string;
      anthropicVersion?: string;
    },
  ) {}

  /**
   * Create a message (non-streaming). Response is full JSON body.
   */
  async createMessage(
    params: MessagesCreateParams & Record<string, unknown>,
  ): Promise<MessagesResponse> {
    if (params.stream === true) {
      throw new Error(
        "AnthropicClient.createMessage does not support stream: true; use the streaming API separately.",
      );
    }

    const baseUrl = this.options?.baseUrl ?? DEFAULT_BASE;
    const version = this.options?.anthropicVersion ?? DEFAULT_VERSION;
    const endpoint = `${baseUrl}/v1/messages`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": version,
      },
      body: JSON.stringify(params),
    });

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new AnthropicApiError("Anthropic: response was not valid JSON", {
        httpStatus: res.status,
        endpoint,
      });
    }

    if (!res.ok) {
      const apiError = parseErrorBody(json);
      const msg =
        apiError?.message ??
        (typeof json === "object" &&
        json &&
        "message" in json &&
        typeof (json as { message: unknown }).message === "string"
          ? (json as { message: string }).message
          : `HTTP ${res.status}`);
      throw new AnthropicApiError(msg, {
        httpStatus: res.status,
        endpoint,
        apiError,
      });
    }

    return json as MessagesResponse;
  }
}

export { DEFAULT_BASE, DEFAULT_VERSION };
