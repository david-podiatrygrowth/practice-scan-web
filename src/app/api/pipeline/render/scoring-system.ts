/**
 * Scoring rubric and instructions for Claude (render / report generation).
 * Inlined so the Messages API receives the full text; the model has no repo filesystem.
 */

const SCORING_RUBRIC_MARKDOWN = `
# Practice Visibility Scan — Scoring Rubric

Use this document for **per-item** scoring. Category totals must sum to the category maximum; the six categories sum to **100**.

---

## Website Fundamentals (max 20)

Score each sub-item, then total (cap at 20).

| Item | Max | Guidance |
|------|-----|----------|
| Security & accessibility (HTTPS, basic crawlability) | 5 | Broken/mixed content, major errors deduct heavily. |
| Mobile usability & readability | 5 | Tap targets, text size, layout breaks on small screens. |
| Core UX (navigation, contact path, hours/location clarity) | 5 | Can a patient find phone, address, and book/call easily? |
| Trust & professionalism (branding, outdated design, obvious errors) | 5 | First-impression quality; glaring trust issues. |

---

## Google Business Profile (max 20)

| Item | Max | Guidance |
|------|-----|----------|
| Profile existence & verification | 5 | No profile = cap category low per SKILL edge cases. |
| NAP consistency with website | 4 | Name, address, phone alignment. |
| Categories & services | 4 | Relevance and completeness for specialty. |
| Photos, hours, attributes | 4 | Freshness, accuracy, completeness. |
| Posts / Q&A / engagement signals (if visible) | 3 | Optional depth; 0 if N/A without inflating. |

---

## Local Search Rankings (max 20)

Based on scan data (e.g. grid / SoLV). Adjust if methodology in payload differs.

| Item | Max | Guidance |
|------|-----|----------|
| Primary keyword performance | 8 | Dominant commercial/local intent term for the practice. |
| Secondary keywords (aggregate) | 8 | Consistency across additional terms in scan. |
| Competitive context / coverage | 4 | How broadly "visible" vs. hyper-local blind spots. |

---

## Online Reviews (max 20)

| Item | Max | Guidance |
|------|-----|----------|
| Volume & recency | 6 | Enough recent signal to trust reputation. |
| Average rating & distribution | 6 | Stars and spread; obvious review issues. |
| Response rate & quality | 4 | Owner responses where applicable. |
| Cross-platform presence | 4 | GBP vs. other visible platforms (if data available). |

---

## Content & SEO (max 10)

| Item | Max | Guidance |
|------|-----|----------|
| On-page relevance (services, location, specialty) | 4 | Title, headings, body match patient intent. |
| Local signals (location pages, schema if inferable) | 3 | Clear geographic and practice signals. |
| Thin/duplicate/obvious gaps | 3 | Penalize missing core pages or boilerplate-only content. |

---

## Patient Engagement (max 10)

| Item | Max | Guidance |
|------|-----|----------|
| Booking / scheduling path | 4 | Online booking, clear call, forms. |
| Forms & contact friction | 3 | Reasonable steps; broken forms = heavy deduction. |
| Phone click-to-call, maps, directions | 3 | Obvious patient actions supported. |

---

## Totals

| Category | Max |
|----------|-----|
| Website Fundamentals | 20 |
| Google Business Profile | 20 |
| Local Search Rankings | 20 |
| Online Reviews | 20 |
| Content & SEO | 10 |
| Patient Engagement | 10 |
| **Total** | **100** |

Only **category-level** scores appear in the final report document; per-item scoring is internal to reach honest category totals.
`.trim();

/**
 * Full scoring instructions for Claude: category caps plus complete rubric.
 */
export function buildScoringSystemPrompt(): string {
  return [
    "## Scoring system",
    "",
    "Use the **full rubric** below for per-item scoring. Six categories total **100** points:",
    "",
    "| Category | Max Points |",
    "|----------|-----------|",
    "| Website Fundamentals | 20 |",
    "| Google Business Profile | 20 |",
    "| Local Search Rankings | 20 |",
    "| Online Reviews | 20 |",
    "| Content & SEO | 10 |",
    "| Patient Engagement | 10 |",
    "| **Total** | **100** |",
    "",
    "---",
    "",
    "### Rubric (per-item breakdowns)",
    "",
    SCORING_RUBRIC_MARKDOWN,
    "",
    "---",
    "",
    "Score each item per the rubric above. Be honest — prospects respect accuracy more than flattery. This is peer-to-peer, not a sales pitch.",
    "",
    "**Important:** The scoring drives the Score Summary table and the overall score box, but the individual per-item scoring tables are NOT included in the report. The scoring rubric is used internally to arrive at the category totals. Only the category-level scores appear in the final document.",
  ].join("\n");
}
