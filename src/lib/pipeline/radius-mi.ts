/** Local Falcon / report scan radius in miles (server-side bounds). */
export function clampRadiusMi(r: number): number {
  if (!Number.isFinite(r) || r <= 0) return 5;
  return Math.min(100, Math.max(0.1, r));
}

/**
 * Map county-level population density (people / sq mi) to a scan radius.
 * Denser areas use a smaller ring; rural areas use a wider ring.
 */
export function radiusMiFromCountyDensity(densityPerSqMi: number): number {
  if (!Number.isFinite(densityPerSqMi) || densityPerSqMi <= 0) return 5;
  if (densityPerSqMi >= 5000) return 3;
  if (densityPerSqMi >= 2000) return 4;
  if (densityPerSqMi >= 1000) return 5;
  if (densityPerSqMi >= 500) return 7;
  return 10;
}
