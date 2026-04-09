/**
 * Anthropic Messages API — subset of request/response shapes.
 * @see https://docs.anthropic.com/en/api/messages
 */

export type AnthropicMessageContentBlock =
  | { type: "text"; text: string }
  | Record<string, unknown>;

export type AnthropicMessageParam = {
  role: "user" | "assistant";
  content: string | AnthropicMessageContentBlock[];
};

/**
 * Body for POST /v1/messages (non-streaming).
 * Extra fields (tools, tool_choice, etc.) can be added at call sites via intersection.
 */
export type MessagesCreateParams = {
  model: string;
  max_tokens: number;
  messages: AnthropicMessageParam[];
  system?: string | string[];
  metadata?: { user_id?: string };
  stop_sequences?: string[];
  temperature?: number;
  top_k?: number;
  top_p?: number;
  /** Omit or false for this client; `true` is rejected at runtime (different response shape). */
  stream?: boolean;
};

export type MessagesResponse = {
  id: string;
  type: string;
  role: string;
  content: AnthropicMessageContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence?: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
};

export type AnthropicErrorResponse = {
  type?: string;
  error?: {
    type?: string;
    message?: string;
  };
};
