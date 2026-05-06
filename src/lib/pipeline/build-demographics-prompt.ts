import type { PipelineState } from "./types";

/**
 * User message for Claude: neighborhood income vs city average within scan radius.
 * Relies on model knowledge of US geography and economics; live web browsing is not available in this API path — see {@link DEMOGRAPHICS_SYSTEM_PROMPT}.
 */
export function buildDemographicsPrompt(state: PipelineState): string {
  const r = state.resolve;
  if (!r?.name?.trim()) {
    throw new Error("buildDemographicsPrompt requires state.resolve");
  }

  const practiceName =
    state.input.practiceName?.trim() || r.name.trim();
  const address = r.formattedAddress?.trim() || "Not provided";
  const city = state.input.city?.trim();
  const region = state.input.state?.trim();
  const radiusMi =
    state.scans?.scanRadiusMi ??
    state.radius?.radiusMi ??
    state.input.radiusMi ??
    5;

  const localeHint = [city, region].filter(Boolean).join(", ");

  return [
    `You are helping write the **Demographic Opportunity** section of a practice marketing report.`,
    ``,
    `**Practice:** ${practiceName}`,
    `**Address / area:** ${address}`,
    localeHint ? `**City / state (from intake):** ${localeHint}` : null,
    `**Geo-grid scan radius used in this audit:** ${radiusMi} miles (treat this as the relevant local market ring around the practice).`,
    ``,
    `---`,
    ``,
    `## Task`,
    ``,
    `Produce **markdown** suitable for a prospect-facing report.`,
    ``,
    `1. Identify **4–6 real neighborhoods, suburbs, or named areas** that lie within roughly **${radiusMi} miles** of this practice and are plausible for patient draw (use your knowledge of the metro / region). Name them clearly.`,
    `2. For each area, give a **concise comparison of typical median household income** vs **the core city or primary municipality average** you associate with this address (state clearly when you are estimating).`,
    `3. Frame the **opportunity**: explain how the practice may be **missing high-income, cash-pay friendly patients** in surrounding **more affluent** pockets compared to a citywide average.`,
    ``,
    `## Output structure (markdown)`,
    ``,
    `- Title: **Demographic Opportunity** (use \`##\` or similar).`,
    `- Short intro paragraph (2–4 sentences).`,
    `- A **comparison table** or bullet list: each neighborhood + income positioning vs city benchmark (use approximate ranges or wording like "well above" / "modestly above" where exact numbers are uncertain).`,
    `- A **Closing opportunity** subsection: 2–3 sentences aimed at the prospect (why this matters for growth).`,
    ``,
    `**Tone:** professional, specific, not fear-based. Do not invent precise Census tract IDs; it is OK to qualify estimates.`,
    ``,
    `If the location is ambiguous, pick the most likely metro and say so briefly.`,
  ]
    .filter((line) => line != null)
    .join("\n");
}

export const DEMOGRAPHICS_SYSTEM_PROMPT =
  "You write clear markdown for healthcare practice owners. You cannot browse the web in real time—use well-established geographic and economic patterns, label estimates clearly, and avoid fake precision. Prefer markdown headings, lists, and one small table.";
