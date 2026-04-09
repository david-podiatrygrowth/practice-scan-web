/**
 * Report structure and formatting spec for Practice Visibility Scan (.docx generation).
 * Edit this file to change report structure; consumed by the render pipeline / Claude prompts.
 */
export const REPORT_TEMPLATE = `# Report Template

This defines the exact content structure for every Practice Visibility Scan. Follow this order. Adapt the content to each practice, but keep the structure fixed.

---

## Page 1: Logo + Title + Score + Summary

### Logo (centered)
Use \`PG-Claude.png\` (the transparent RGBA PNG with dark text). Centered, scaled to ~340Ã—40px. Do NOT use \`Podiatry_Growth_Logo_Mark_Color_Retina.png\` â€” that file is a JPEG with a black background despite the \`.png\` extension.

### Title Block (centered)
\`\`\`
PRACTICE VISIBILITY SCAN
Executive Summary
[Practice Name]
[City, State] ([area description, e.g., "Downtown / The Loop"])
\`\`\`

### Score Box (centered, color-coded per brand.md)
\`\`\`
YOUR VISIBILITY SCORE
[XX] / 100
[Label â€” e.g., "Fair â€” Significant Room to Grow"]
\`\`\`

### Strengths / Problems Table
Two-column table. Header row: green (Strengths), red (Problems). Column widths: 4680, 4680.

Each column contains 3 items:
- **Strengths:** The practice's best assets (reviews, website, rankings, etc.)
- **Problems:** The biggest issues holding them back (keep it high-level, create urgency)

Each item: bold title + 1â€“2 sentence description. Keep it scannable.

**No "Action Items" column.** The report shows pain, not a to-do list.

---

## Pages 1â€“2: Where Patients Find You on Google

### Section Header
"Where Patients Find You on Google"

### Introductory Text
"Each dot on these grids represents a Google search from that location. Green means you show up in the top 3. Yellow means patients have to scroll. Red means you don't show up."

### Legend Bar
Three-cell table (no borders), colored backgrounds:
- Green: "1â€“3 = Patients see you first"
- Yellow/Orange: "4â€“7 = Have to scroll to find you"
- Red: "8+ = You don't show up"

### Per-Keyword Blocks
For each scanned keyword, include:

1. **Keyword heading** â€” e.g., \`Keyword: “podiatrist”\` (Arial 24, Bold, Blue 900)
2. **Stats line** â€” “Average Rank: X.XX | Share of Local Voice: XX.XX% | Found in XX of XX points (XX%)” (Arial 20, Bold, Blue 500)
3. **Plain-English analysis** â€” 2â€”3 sentences. Which directions are strong? Which are weak? What competitor is winning where? Write for a podiatrist, not a marketer.
4. **Grid image** â€” Download from the \`image\` URL returned by \`getLocalFalconReport\` and embed with \`ImageRun\` (468Ã—468px, centered). See \`references/grid_capture.md\` for the full implementation. Falls back to \`[INSERT GRID IMAGE: keyword name]\` placeholder only if the download fails.

### Bottom Line Box
Blue 100 background, Blue 500 border (6pt). Contains:
- "**Bottom Line:**" (bold, Blue 900) followed by 3â€“4 sentences synthesizing the key takeaway from the scan data. What's working, what's the main problem, and what's the opportunity.

---

## Page 3: Detailed Findings

### Section Title (centered)
"DETAILED FINDINGS"

### Practice Info Table
Two-column table (label | value). Label column: Blue 100 background. Widths: 3120, 6240.
- Practice Name
- Doctor Name
- Website
- Location(s)
- Report Date

### Score Summary Table
Three-column table (Category | Score | Status). Widths: 4680, 2340, 2340.
- Header row: Blue 900 background, white text
- All 6 categories listed
- Score column is color-coded by performance level
- Status column is solid-color with white text

**This is the only scoring table in the report.** No per-item detail breakdowns appear.

---

## Page 3: The Demographic Opportunity

### Section Heading
"The Demographic Opportunity" (Arial 32, Bold, Blue 900)

### Opening Paragraph
Connect the practice's location to surrounding affluent neighborhoods. Explain that their search visibility drops off in the directions where high-income patients live.

### Income Table
Two-column table (Neighborhood | Median Household Income). Widths: 4680, 4680.
- Header row: Blue 900 background, white text
- Include 4â€“6 neighborhoods from the scan radius
- Bold the practice's own neighborhood row
- Show city/county average as the last row for contrast
- Income values in green bold

### Analysis Paragraphs
2â€“3 sentences connecting the income data to the scan data. Which high-income neighborhoods overlap with the practice's weakest search zones? These are the patients who can afford cash-pay services but are finding competitors first.

---

## Page 4: Summary

### Section Title (centered)
"SUMMARY"

### General Observations
Heading: "General Observations" (Arial 26, Bold, Blue 900)

Single bordered box (standard Gray 200 borders, **Blue Light \`E3F2FD\` background**) containing 3â€“4 observations as flowing paragraphs. Each observation:
- **Bold title in Blue 900** followed by an em dash and plain-text explanation
- Focus on the positives and context â€” what's working, what the practice has going for it
- Separate observations with paragraph spacing, not bullet points

### Critical Observations
Heading: "âš  Critical Observations" (Arial 26, Bold, Red)

Single box with RED border (3pt, \`C62828\`, **Red Light \`FFEBEE\` background**) containing 2â€“3 critical issues as flowing paragraphs. Each observation:
- **Bold title in Red** followed by an em dash and plain-text explanation
- These create urgency â€” the problems the prospect needs help solving
- Be specific: name competitors, cite exact numbers, reference their survey answers

**No "Priority Opportunities," "Recommended Next Steps," or "Quick Wins" sections.** The summary shows what's good and what's broken. The call is where solutions happen.

---

## Page 4: Closing CTA (centered)

**Use larger text for the CTA section:**

\`\`\`
Questions about this report? Let's talk.          (Arial 32, Bold, Blue 900)

jim@podiatrygrowth.com  |  podiatrygrowth.com     (Arial 26, Blue 500)
Schedule a call: calendar.app.google/VH7vVEeDHQARKM8x8   (Arial 26, Blue 500 link)
\`\`\`

---

## Multi-Location Notes

For practices with multiple locations:
- Show separate grid blocks per location in the "Where Patients Find You" section
- Call out differences in review counts and rankings between locations
- Score based on the primary/strongest location but note gaps at secondary locations
- The demographic section can compare the different trade areas

---

## Grid Images

Grid images are downloaded automatically from LocalFalcon's static image server and embedded in the .docx. See \`references/grid_capture.md\` for the full implementation.

**Image URLs (from \`getLocalFalconReport\` response):**
- Numbered grid: \`image\` field â€" \`https://lf-static-v2.localfalcon.com/image/{report_key}\` (1000Ã—1000 PNG)
- Heatmap: \`heatmap\` field â€" \`https://lf-static-v2.localfalcon.com/heatmap-img/{report_key}\` (500Ã—500 PNG)

Use the numbered grid (\`image\`) in the report. No auth required â€" these are public static assets with CORS enabled.

**Fallback:** If the download fails, insert a text placeholder: \`[INSERT GRID IMAGE: keyword name]\` and note it for Jim.`;
