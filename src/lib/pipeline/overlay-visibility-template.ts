import type { VisibilityReportTemplateData } from "@/lib/pipeline/render-report-content";
import type { PipelineState } from "@/lib/pipeline/types";

function parseNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Grid side length from Local Falcon payload (e.g. 5 → 25 points). */
function gridTotalPoints(payload: Record<string, unknown>): number {
  const gs = payload.grid_size;
  const n =
    typeof gs === "string" && /^\d+$/.test(gs.trim())
      ? parseInt(gs.trim(), 10)
      : typeof gs === "number" && Number.isFinite(gs)
        ? Math.floor(gs)
        : 5;
  return Math.max(1, n) * Math.max(1, n);
}

/**
 * Count points where rank is in top 3 (if `data_points` exists).
 */
function countTopThreeRanks(
  payload: Record<string, unknown>,
): { found: number; total: number } | null {
  const raw = payload.data_points;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  let found = 0;
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const r = parseNum(o.rank ?? o.arp ?? o.avg_rank);
    if (r != null && r <= 3) found++;
  }
  return { found, total: raw.length };
}

function formatSolvPct(solv: number | undefined): string {
  if (solv == null || !Number.isFinite(solv)) return "";
  const v = solv <= 1 ? solv * 100 : solv;
  return `${Math.round(v)}%`;
}

function stubByKeyword(state: PipelineState, keyword: string) {
  return state.scans?.reports?.find(
    (r) => r.keyword?.trim().toLowerCase() === keyword.trim().toLowerCase(),
  );
}

/**
 * Overlay pipeline-derived numbers and locations so scan stats stay aligned with LF data.
 */
export function overlayVisibilityTemplateFromState(
  data: VisibilityReportTemplateData,
  state: PipelineState,
): VisibilityReportTemplateData {
  const resolve = state.resolve;
  const keywords =
    state.scans?.keywords?.length && state.scans.keywords.length > 0
      ? state.scans.keywords
      : (state.retrieveScans?.reports.map((r) => r.keyword) ?? []);

  const o: VisibilityReportTemplateData = { ...data };

  if (resolve?.name?.trim()) {
    o.practice_name = resolve.name.trim();
  }

  if (resolve?.formattedAddress?.trim()) {
    o.location_address = resolve.formattedAddress.trim();
  }

  const city = state.input.city?.trim();
  const st = state.input.state?.trim();
  if (city && st) {
    o.location_city_state = `${city}, ${st}`;
    o.practice_city = o.practice_city || city;
  } else if (resolve?.formattedAddress) {
    const parts = resolve.formattedAddress.split(",").map((s) => s.trim());
    if (parts.length >= 2) {
      o.practice_city = o.practice_city || parts[parts.length - 2] || o.practice_city;
    }
  }

  if (!o.report_date?.trim()) {
    o.report_date = new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  if (resolve?.websiteUrl?.trim()) {
    const u = resolve.websiteUrl.trim().replace(/^https?:\/\//i, "");
    o.website = u;
  }

  const reports = state.retrieveScans?.reports ?? [];
  for (let i = 0; i < 2; i++) {
    const kw = keywords[i];
    if (!kw?.trim()) continue;
    const retrieved = reports.find(
      (r) => r.keyword?.trim().toLowerCase() === kw.trim().toLowerCase(),
    );
    const payload = retrieved?.payload ?? {};
    const stub = stubByKeyword(state, kw);
    const totalGrid = gridTotalPoints(payload);
    const arp = parseNum(payload.arp) ?? stub?.arp;
    const solvNum = parseNum(payload.solv) ?? stub?.solv;
    const counts = countTopThreeRanks(payload);
    const found = counts?.found;
    const total = counts?.total ?? totalGrid;
    const pct =
      found != null && total > 0
        ? `${Math.round((100 * found) / total)}%`
        : "";

    if (i === 0) {
      o.kw1_term = kw;
      if (arp != null) o.kw1_avg_rank = arp.toFixed(2);
      o.kw1_solv = formatSolvPct(solvNum);
      if (found != null) o.kw1_found = String(found);
      o.kw1_total = String(total);
      if (pct) o.kw1_pct = pct;
    } else {
      o.kw2_term = kw;
      if (arp != null) o.kw2_avg_rank = arp.toFixed(2);
      o.kw2_solv = formatSolvPct(solvNum);
      if (found != null) o.kw2_found = String(found);
      o.kw2_total = String(total);
      if (pct) o.kw2_pct = pct;
    }
  }

  o.swot_items = o.swot_items.slice(0, 3);

  return o;
}
