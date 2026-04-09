import { NextResponse } from "next/server";
import { assistantTextFromMessage } from "@/lib/anthropic/assistant-text";
import { createAnthropicClient } from "@/lib/anthropic";
import { AnthropicApiError } from "@/lib/anthropic/errors";
import { buildPracticeVisibilityAnalysisPrompt } from "@/lib/pipeline/build-practice-visibility-prompt";
import { fail } from "@/lib/pipeline/server-json";
import type { PipelineState } from "@/lib/pipeline/types";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * Builds the Podiatry Growth analysis prompt from retrieved scans and sends it to Claude.
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
  if (!state.retrieveScans?.reports?.length) {
    return fail(
      "analyze-scan",
      "retrieve-scans must complete with at least one report",
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

  const prompt = buildPracticeVisibilityAnalysisPrompt(state);
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;

  try {
    const res = await anthropic.createMessage({
      model,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = assistantTextFromMessage(res);
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
