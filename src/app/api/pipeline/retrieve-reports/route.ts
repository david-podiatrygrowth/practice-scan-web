import { NextResponse } from "next/server";
import { createLocalFalconClient } from "@/lib/localfalcon";
import { LocalFalconApiError } from "@/lib/localfalcon/errors";
import { fail } from "@/lib/pipeline/server-json";
import type { PipelineState, RetrievedScanReport } from "@/lib/pipeline/types";

export const maxDuration = 120;

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchReportUntilReady(
  lf: ReturnType<typeof createLocalFalconClient>,
  reportKey: string,
): Promise<Record<string, unknown>> {
  const path = `/v1/reports/${encodeURIComponent(reportKey)}/`;
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const result = await lf.getLocalFalconReport(reportKey);
    if (result.httpStatus === 200) {
      const raw = result.envelope.data;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
      }
      return {};
    }
    if (result.httpStatus === 202) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
  }
  throw new LocalFalconApiError(
    `Timed out waiting for report to finish processing (${reportKey})`,
    {
      code: 504,
      httpStatus: 504,
      endpoint: path,
    },
  );
}

/**
 * Fetch full scan JSON for each report_key from the scans step (polls on HTTP 202).
 */
export async function POST(req: Request) {
  let body: { state?: PipelineState };
  try {
    body = await req.json();
  } catch {
    return fail("retrieve-reports", "Request body must be JSON", "invalid_json");
  }

  const state = body.state;
  if (!state?.scans?.reports?.length) {
    return fail(
      "retrieve-reports",
      "scans step must complete with at least one report",
      "missing_prereqs",
    );
  }

  const missingKeys: string[] = [];
  for (const r of state.scans.reports) {
    if (!r.reportKey?.trim()) {
      missingKeys.push(r.keyword || "(unknown keyword)");
    }
  }
  if (missingKeys.length > 0) {
    return fail(
      "retrieve-reports",
      `Every scan needs a reportKey from Local Falcon. Missing for: ${missingKeys.join(", ")}`,
      "missing_report_key",
    );
  }

  let lf: ReturnType<typeof createLocalFalconClient>;
  try {
    lf = createLocalFalconClient();
  } catch {
    return fail(
      "retrieve-reports",
      "LOCALFALCON_API_KEY is not configured",
      "missing_api_key",
      500,
    );
  }

  try {
    const reports: RetrievedScanReport[] = [];
    for (const row of state.scans.reports) {
      const reportKey = row.reportKey!.trim();
      const payload = await fetchReportUntilReady(lf, reportKey);
      reports.push({
        reportKey,
        keyword: row.keyword,
        payload,
      });
    }

    return NextResponse.json({
      ok: true,
      step: "retrieve-reports" as const,
      data: { reports },
    });
  } catch (e) {
    if (e instanceof LocalFalconApiError) {
      console.error("[retrieve-reports] Local Falcon API error:", e.message);
      return fail("retrieve-reports", e.message, "localfalcon_error", 500);
    }
    throw e;
  }
}
