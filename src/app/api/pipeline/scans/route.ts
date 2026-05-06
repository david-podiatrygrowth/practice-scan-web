import { NextResponse } from "next/server";
import { createLocalFalconClient } from "@/lib/localfalcon";
import { LocalFalconApiError } from "@/lib/localfalcon/errors";
import type {
  LocalFalconReportSummary,
  LocalFalconRunScanGridSize,
} from "@/lib/localfalcon/types";
import { fail } from "@/lib/pipeline/server-json";
import { clampRadiusMi } from "@/lib/pipeline/radius-mi";
import type { PipelineState, ScanReportStub } from "@/lib/pipeline/types";

/** Allow sequential run-scan calls to finish (adjust on your Vercel plan). */
export const maxDuration = 120;

const DEFAULT_GRID_SIZE: LocalFalconRunScanGridSize = "5";

const DEFAULT_KEYWORDS = ["podiatrist", "foot doctor"] as const;

function parseOptionalMetric(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function scanStubFromRunData(
  keyword: string,
  data: Record<string, unknown> | undefined,
): ScanReportStub {
  const reportKey =
    typeof data?.report_key === "string" ? data.report_key : undefined;
  const image = typeof data?.image === "string" ? data.image : undefined;
  const heatmap =
    typeof data?.heatmap === "string" ? data.heatmap : undefined;
  return {
    keyword,
    reportKey,
    arp: parseOptionalMetric(data?.arp),
    solv: parseOptionalMetric(data?.solv),
    gridImageUrl: image ?? heatmap,
  };
}

function normalizeKeyword(k: string): string {
  return k.trim().toLowerCase();
}

function radiusMatches(rowRadius: string | undefined, expectedMi: number): boolean {
  if (rowRadius == null || String(rowRadius).trim() === "") return true;
  const a = parseFloat(String(rowRadius));
  if (!Number.isFinite(a)) return true;
  return Math.abs(a - expectedMi) < 0.0001;
}

/**
 * Row from listScanReports matches the scan we would run (same location + keyword + grid + radius).
 */
function summaryMatchesPlannedScan(
  row: LocalFalconReportSummary,
  placeId: string,
  keyword: string,
  gridSize: string,
  radiusMi: number,
): boolean {
  const pid = row.place_id?.trim();
  if (!pid || pid !== placeId.trim()) return false;
  const kw = row.keyword?.trim();
  if (!kw || normalizeKeyword(kw) !== normalizeKeyword(keyword)) return false;
  const gs = row.grid_size?.trim();
  if (gs && gs !== gridSize) return false;
  if (!radiusMatches(row.radius, radiusMi)) return false;
  const plat = row.platform?.trim().toLowerCase();
  if (plat && plat !== "google") return false;
  const meas = row.measurement?.trim().toLowerCase();
  if (meas && meas !== "mi") return false;
  return Boolean(row.report_key?.trim());
}

function parseReportTimestamp(row: LocalFalconReportSummary): number {
  const t = row.timestamp?.trim();
  if (t) {
    const n = parseInt(t, 10);
    if (Number.isFinite(n)) return n;
  }
  const d = row.date?.trim();
  if (d) {
    const parsed = Date.parse(d);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return 0;
}

function scanStubFromSummary(keyword: string, row: LocalFalconReportSummary): ScanReportStub {
  return {
    keyword,
    reportKey: row.report_key?.trim(),
    arp: row.arp ? parseFloat(row.arp) : undefined,
    solv: row.solv ? parseFloat(row.solv) : undefined,
    gridImageUrl: row.image?.trim() ? row.image : row.heatmap?.trim() ? row.heatmap : undefined,
  };
}

const LIST_REPORTS_MAX_PAGES = 15;

function normalizeNextToken(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t ? t : undefined;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  return undefined;
}

/**
 * Find the newest listable report that matches planned scan parameters (avoids re-running run-scan).
 */
async function findCompletedMatchingReport(
  lf: ReturnType<typeof createLocalFalconClient>,
  placeId: string,
  keyword: string,
  gridSize: LocalFalconRunScanGridSize,
  radiusMi: number,
): Promise<LocalFalconReportSummary | null> {
  const matches: LocalFalconReportSummary[] = [];
  let nextToken: string | undefined;
  for (let page = 0; page < LIST_REPORTS_MAX_PAGES; page++) {
    const env = await lf.listScanReports({
      place_id: placeId.trim(),
      keyword,
      platform: "google",
      grid_size: gridSize,
      limit: 100,
      next_token: nextToken,
    });
    const list = env.data?.reports ?? [];
    for (const row of list) {
      if (summaryMatchesPlannedScan(row, placeId, keyword, gridSize, radiusMi)) {
        matches.push(row);
      }
    }
    nextToken = normalizeNextToken(env.data?.next_token);
    if (!nextToken) break;
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => parseReportTimestamp(b) - parseReportTimestamp(a));
  return matches[0] ?? null;
}

/**
 * Run Local Falcon geo-grid scans per keyword using resolve.placeId and center
 * coordinates. Location must exist in saved locations (resolve handles that after search).
 *
 * @see https://docs.localfalcon.com/#tag/scans--reports/POST/v2/run-scan/
 */
export async function POST(req: Request) {
  let body: { state?: PipelineState };
  try {
    body = await req.json();
  } catch {
    return fail("scans", "Request body must be JSON", "invalid_json");
  }

  const state = body.state;
  if (!state?.resolve) {
    return fail("scans", "resolve step must complete first", "missing_resolve");
  }
  if (!state?.radius) {
    return fail("scans", "radius step must complete first", "missing_radius");
  }

  const { placeId, lat, lng } = state.resolve;
  if (!placeId?.trim()) {
    return fail("scans", "resolve.placeId is required", "missing_place_id");
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail(
      "scans",
      "resolve.lat and resolve.lng must be valid numbers",
      "invalid_coordinates",
    );
  }
  if (lat === 0 && lng === 0) {
    return fail(
      "scans",
      "resolve coordinates are missing or invalid (0,0)",
      "invalid_coordinates",
    );
  }

  let lf: ReturnType<typeof createLocalFalconClient>;
  try {
    lf = createLocalFalconClient();
  } catch {
    return fail(
      "scans",
      "LOCALFALCON_API_KEY is not configured",
      "missing_api_key",
      500,
    );
  }

  const scanRadiusMi = clampRadiusMi(state.radius.radiusMi);
  const keywords = [...DEFAULT_KEYWORDS];

  try {
    const reports: ScanReportStub[] = [];
    for (const keyword of keywords) {
      const existing = await findCompletedMatchingReport(
        lf,
        placeId.trim(),
        keyword,
        DEFAULT_GRID_SIZE,
        scanRadiusMi,
      );
      if (existing?.report_key?.trim()) {
        console.log(
          "[scans] Reusing existing report for",
          keyword,
          existing.report_key,
        );
        reports.push(scanStubFromSummary(keyword, existing));
        continue;
      }

      const envelope = await lf.runScan({
        place_id: placeId.trim(),
        keyword,
        lat,
        lng,
        grid_size: DEFAULT_GRID_SIZE,
        radius: scanRadiusMi,
        measurement: "mi",
        platform: "google",
        // false = wait for scan to finish (needs maxDuration / plan headroom).
        // Set true if you hit serverless timeouts and poll GET report later.
        eager: false,
      });
      reports.push(
        scanStubFromRunData(
          keyword,
          envelope.data as Record<string, unknown> | undefined,
        ),
      );
    }

    return NextResponse.json({
      ok: true,
      step: "scans" as const,
      data: {
        scanRadiusMi,
        keywords,
        reports,
      },
    });
  } catch (e) {
    if (e instanceof LocalFalconApiError) {
      console.error("[scans] Local Falcon API error:", e.message);
      return fail("scans", e.message, "localfalcon_error", 500);
    }
    throw e;
  }
}
