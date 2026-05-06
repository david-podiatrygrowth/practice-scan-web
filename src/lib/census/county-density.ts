/**
 * US Census Geocoder + ACS county profile (no API key for public endpoints).
 */

const ACSSENTINEL = -666666666;

type GeocoderCountyRow = {
  GEOID?: string;
  NAME?: string;
  STATE?: string;
  COUNTY?: string;
};

type GeocoderEnvelope = {
  result?: {
    geographies?: {
      Counties?: GeocoderCountyRow[];
    };
  };
};

function parseStateCountyFips(row: GeocoderCountyRow | undefined): {
  state: string;
  county: string;
} | null {
  if (!row) return null;
  const geoid = row.GEOID?.trim();
  if (geoid && geoid.length >= 5) {
    const state = geoid.slice(0, 2);
    const county = geoid.slice(2);
    if (/^\d{2}$/.test(state) && /^\d{3}$/.test(county)) {
      return { state, county };
    }
  }
  const st = row.STATE?.trim();
  const co = row.COUNTY?.trim();
  if (st && co && /^\d+$/.test(st) && /^\d+$/.test(co)) {
    return { state: st.padStart(2, "0"), county: co.padStart(3, "0") };
  }
  return null;
}

export type CountyDensityLookup = {
  countyName: string;
  densityPerSqMi: number;
  stateFips: string;
  countyFips: string;
};

export async function lookupCountyDensityFromCoordinates(
  lat: number,
  lng: number,
): Promise<CountyDensityLookup | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const geoUrl = new URL(
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates",
  );
  geoUrl.searchParams.set("x", String(lng));
  geoUrl.searchParams.set("y", String(lat));
  geoUrl.searchParams.set("benchmark", "Public_AR_Current");
  geoUrl.searchParams.set("vintage", "Current_Current");
  geoUrl.searchParams.set("format", "json");

  const geoRes = await fetch(geoUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!geoRes.ok) return null;

  const geoJson = (await geoRes.json()) as GeocoderEnvelope;
  const countyRow = geoJson.result?.geographies?.Counties?.[0];
  const fips = parseStateCountyFips(countyRow);
  if (!fips) return null;

  const countyName =
    countyRow?.NAME?.trim() || `County ${fips.state}${fips.county}`;

  const acsUrl = new URL(
    "https://api.census.gov/data/2022/acs/acs5/profile",
  );
  acsUrl.searchParams.set("get", "NAME,DP05_0086E");
  acsUrl.searchParams.set("for", `county:${fips.county}`);
  acsUrl.searchParams.set("in", `state:${fips.state}`);

  const acsRes = await fetch(acsUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!acsRes.ok) return null;

  const rows = (await acsRes.json()) as string[][];
  if (!Array.isArray(rows) || rows.length < 2) return null;

  const header = rows[0];
  const data = rows[1];
  const nameIdx = header.indexOf("NAME");
  const densIdx = header.indexOf("DP05_0086E");
  if (densIdx < 0 || !data) return null;

  const raw = data[densIdx];
  const n = raw != null ? Number.parseFloat(String(raw)) : Number.NaN;
  if (!Number.isFinite(n) || n === ACSSENTINEL || n < 0) return null;

  const resolvedName =
    nameIdx >= 0 && data[nameIdx]
      ? String(data[nameIdx]).trim()
      : countyName;

  return {
    countyName: resolvedName,
    densityPerSqMi: n,
    stateFips: fips.state,
    countyFips: fips.county,
  };
}
