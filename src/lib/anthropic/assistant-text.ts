import type { MessagesResponse } from "@/lib/anthropic/types";

/** Concatenate assistant `text` blocks from a Messages API response. */
export function assistantTextFromMessage(msg: MessagesResponse): string {
  let out = "";
  for (const block of msg.content ?? []) {
    if (
      block &&
      typeof block === "object" &&
      block.type === "text" &&
      typeof (block as { text?: string }).text === "string"
    ) {
      out += (block as { text: string }).text;
    }
  }
  return out.trim();
}
