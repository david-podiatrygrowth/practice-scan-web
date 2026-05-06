import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { assistantTextFromMessage } from "@/lib/anthropic/assistant-text";
import { createAnthropicClient } from "@/lib/anthropic";
import { AnthropicApiError } from "@/lib/anthropic/errors";
import {
  buildRenderSystemPrompt,
  buildRenderUserPrompt,
} from "@/lib/pipeline/build-render-prompt";
import { embedMapsInRenderedDocx } from "@/lib/pipeline/embed-maps-patch-docx";
import { fetchFirstTwoKeywordMapBuffers } from "@/lib/pipeline/fetch-scan-map-images";
import { overlayVisibilityTemplateFromState } from "@/lib/pipeline/overlay-visibility-template";
import { buildDocxFromTemplate } from "@/lib/pipeline/render-docx-template";
import {
  extractJsonFromAssistantText,
  parseVisibilityReportTemplateJson,
  type VisibilityReportTemplateData,
} from "@/lib/pipeline/render-report-content";
import { fail } from "@/lib/pipeline/server-json";
import type { PipelineState } from "@/lib/pipeline/types";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function safeReportFileBase(name: string): string {
  const cleaned = name
    .replace(/[^\w\s\-]+/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return cleaned.slice(0, 80) || "Practice";
}

function hasRequiredPipelineSteps(state: PipelineState | undefined): boolean {
  return Boolean(
    state?.resolve &&
      state.radius &&
      state.analyzeGbp &&
      state.scans &&
      state.retrieveScans &&
      state.analyzeScan &&
      state.website &&
      state.analyzeWebsite &&
      state.demographics,
  );
}

/** Text merge (docxtemplater) then map images (`docx` patch). */
async function buildVisibilityDocx(
  templateData: VisibilityReportTemplateData,
  pipeline: PipelineState,
): Promise<Buffer> {
  const textOnly = await buildDocxFromTemplate(templateData);
  const mapPngs = await fetchFirstTwoKeywordMapBuffers(pipeline);
  return embedMapsInRenderedDocx(textOnly, mapPngs);
}

export async function POST(req: Request) {
  let body: { state?: PipelineState };
  try {
    body = await req.json();
  } catch {
    return fail("render", "Request body must be JSON", "invalid_json");
  }

  const state = body.state;
  if (!state || !hasRequiredPipelineSteps(state)) {
    return fail(
      "render",
      "resolve, radius, scans, retrieve-scans, analyze-gbp, analyze-scan, website, analyze-website, and demographics must complete first",
      "missing_prereqs",
    );
  }

  let anthropic: ReturnType<typeof createAnthropicClient>;
  try {
    anthropic = createAnthropicClient();
  } catch {
    return fail(
      "render",
      "ANTHROPIC_API_KEY is not configured",
      "missing_api_key",
      500,
    );
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const system = buildRenderSystemPrompt();
  const user = buildRenderUserPrompt(state);

  try {
    const msgRes = await anthropic.createMessage({
      model,
      max_tokens: 16_384,
      system,
      messages: [{ role: "user", content: user }],
    });

    const assistantRaw = assistantTextFromMessage(msgRes);
    if (!assistantRaw) {
      return fail(
        "render",
        "Model returned no text content",
        "empty_response",
        500,
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = extractJsonFromAssistantText(assistantRaw);
    } catch {
      return fail(
        "render",
        "Model output was not valid JSON (expected a single JSON object)",
        "invalid_model_json",
        500,
      );
    }

    let templateData = parseVisibilityReportTemplateJson(parsedJson);
    templateData = overlayVisibilityTemplateFromState(templateData, state);

    let buffer: Buffer;
    try {
      buffer = await buildVisibilityDocx(templateData, state);
    } catch (e) {
      console.error("[render] docx render/patch error:", e);
      return fail(
        "render",
        e instanceof Error ? e.message : "DOCX generation failed",
        "docx_generation_failed",
        500,
      );
    }

    const fileName = `${safeReportFileBase(state.resolve?.name ?? "Practice")}_Visibility_Report.docx`;
    const base64 = buffer.toString("base64");

    let downloadUrl: string | undefined;
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (blobToken) {
      try {
        const blob = await put(`visibility-reports/${fileName}`, buffer, {
          access: "public",
          token: blobToken,
          addRandomSuffix: true,
          contentType: DOCX_MIME,
        });
        downloadUrl = blob.downloadUrl;
      } catch (e) {
        console.error("[render] Vercel Blob upload failed:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      step: "render" as const,
      data: {
        fileName,
        mimeType: DOCX_MIME,
        base64,
        ...(downloadUrl ? { downloadUrl } : {}),
      },
    });
  } catch (e) {
    if (e instanceof AnthropicApiError) {
      console.error("[render] Anthropic API error:", e.message);
      return fail("render", e.message, "anthropic_error", 500);
    }
    console.error("[render] unexpected error:", e);
    return fail(
      "render",
      e instanceof Error ? e.message : "Report generation failed",
      "render_failed",
      500,
    );
  }
}
