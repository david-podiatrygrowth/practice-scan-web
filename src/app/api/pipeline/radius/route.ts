import { NextResponse } from "next/server";
import { lookupCountyDensityFromCoordinates } from "@/lib/census/county-density";
import { fail } from "@/lib/pipeline/server-json";
import {
  clampRadiusMi,
  radiusMiFromCountyDensity,
} from "@/lib/pipeline/radius-mi";
import type { PipelineState, RadiusResult } from "@/lib/pipeline/types";

/**
 * Choose geo-grid scan radius from optional manual input or county population density (ACS).
 */
export async function POST(req: Request) {
  let body: { state?: PipelineState };
  try {
    body = await req.json();
  } catch {
    return fail("radius", "Request body must be JSON", "invalid_json");
  }

  const state = body.state;
  if (!state?.resolve) {
    return fail("radius", "resolve step must complete first", "missing_resolve");
  }

  const { lat, lng } = state.resolve;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail(
      "radius",
      "resolve.lat and resolve.lng must be valid numbers",
      "invalid_coordinates",
    );
  }
  if (lat === 0 && lng === 0) {
    return fail(
      "radius",
      "resolve coordinates are missing or invalid (0,0)",
      "invalid_coordinates",
    );
  }

  const manual = state.input.radiusMi;
  if (manual != null && Number.isFinite(manual)) {
    const radiusMi = clampRadiusMi(manual);
    const data: RadiusResult = {
      radiusMi,
      method: "input_override",
      rationale:
        "Radius taken from intake (manual override); Census density was not used.",
    };
    return NextResponse.json({
      ok: true,
      step: "radius" as const,
      data,
    });
  }

  const lookup = await lookupCountyDensityFromCoordinates(lat, lng);
  if (!lookup) {
    const radiusMi = clampRadiusMi(5);
    const data: RadiusResult = {
      radiusMi,
      method: "density_unavailable_fallback",
      rationale:
        "Could not determine county population density from Census APIs; using default radius.",
    };
    return NextResponse.json({ ok: true, step: "radius" as const, data });
  }

  const suggested = radiusMiFromCountyDensity(lookup.densityPerSqMi);
  const radiusMi = clampRadiusMi(suggested);
  const data: RadiusResult = {
    radiusMi,
    method: "census_county_density",
    countyName: lookup.countyName,
    countyDensityPerSqMi: lookup.densityPerSqMi,
    rationale: `ACS 2022 county density ~${Math.round(lookup.densityPerSqMi)} people/sq mi (${lookup.countyName}); mapped to a ${radiusMi}-mile scan ring.`,
  };

  return NextResponse.json({ ok: true, step: "radius" as const, data });
}
