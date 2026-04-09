import { NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropic";
import { AnthropicApiError } from "@/lib/anthropic/errors";
import type { MessagesResponse } from "@/lib/anthropic/types";
import { fail } from "@/lib/pipeline/server-json";
import type { PipelineState } from "@/lib/pipeline/types";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_JSON_PER_REPORT = 60_000;
const MAX_TOTAL_USER_CHARS = 200_000;

function assistantText(msg: MessagesResponse): string {
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

/**
 * LLM analysis of retrieved Local Falcon report JSON only (no fetch here).
 */
export async function POST(req: Request) {
  let body: { state?: PipelineState };
  try {
    body = await req.json();
  } catch {
    return fail("analyze-scan", "Request body must be JSON", "invalid_json");
  }

  const state = body.state;
  if (!state?.resolve?.name?.trim()) {
    return fail(
      "analyze-scan",
      "resolve step must complete first",
      "missing_prereqs",
    );
  }
  if (!state.retrieveReports?.reports?.length) {
    return fail(
      "analyze-scan",
      "retrieve-reports must complete with at least one report",
      "missing_prereqs",
    );
  }

  let anthropic: ReturnType<typeof createAnthropicClient>;
  try {
    anthropic = createAnthropicClient();
  } catch {
    return fail(
      "analyze-scan",
      "ANTHROPIC_API_KEY is not configured",
      "missing_api_key",
      500,
    );
  }

  const practice = state.resolve.name.trim();
  const sections: string[] = [];
  let total = 0;
  for (const r of state.retrieveReports.reports) {
    const json = JSON.stringify(r.payload);
    const sliced =
      json.length > MAX_JSON_PER_REPORT
        ? `${json.slice(0, MAX_JSON_PER_REPORT)}\n… [truncated, ${json.length} chars total]`
        : json;
    const section = `### Keyword: ${r.keyword}\nreport_key: ${r.reportKey}\n\`\`\`json\n${sliced}\n\`\`\`\n`;
    if (total + section.length > MAX_TOTAL_USER_CHARS) {
      sections.push(
        "… [Additional reports omitted to stay within context limits.]",
      );
      break;
    }
    sections.push(section);
    total += section.length;
  }

  const userContent = [
    `Practice: ${practice}`,
    "",
    "Below are Local Falcon geo-grid scan report payloads (JSON). Summarize visibility, strengths, gaps, and 3–5 actionable recommendations for this practice.",
    "",
    ...sections,
  ].join("\n");

  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;

  try {
    const res = await anthropic.createMessage({
      model,
      max_tokens: 4096,
      system:
        "You are a local SEO analyst. Be specific and practical. Use plain language suitable for a practice owner.",
      messages: [{ role: "user", content: userContent }],
    });

    const summary = assistantText(res);
    if (!summary) {
      return fail(
        "analyze-scan",
        "Model returned no text content",
        "empty_response",
        500,
      );
    }

    return NextResponse.json({
      ok: true,
      step: "analyze-scan" as const,
      data: { summary },
    });
  } catch (e) {
    if (e instanceof AnthropicApiError) {
      console.error("[analyze-scan] Anthropic API error:", e.message);
      return fail("analyze-scan", e.message, "anthropic_error", 500);
    }
    throw e;
  }
}
