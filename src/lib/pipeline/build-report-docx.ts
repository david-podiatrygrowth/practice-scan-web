import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  PageBreak,
  Paragraph,
  Packer,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";
import type { ReportDocumentContent } from "@/lib/pipeline/render-report-content";

const BLUE_900 = "0B2545";
const BLUE_500 = "1B6B93";
const BLUE_100 = "D6E8F0";
const BLUE_LIGHT = "E3F2FD";
const RED = "C62828";
const RED_LIGHT = "FFEBEE";
const GREEN_HEAD = "E8F5E9";
const RED_HEAD = "FFCDD2";
const GRAY_BORDER = "E0E0E0";

function scoreFill(score: number): string {
  if (score >= 80) return "E8F5E9";
  if (score >= 65) return "E3F2FD";
  if (score >= 50) return "FFF3E0";
  return "FFEBEE";
}

function p(
  text: string,
  opts?: {
    bold?: boolean;
    size?: number;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    after?: number;
  },
): Paragraph {
  return new Paragraph({
    alignment: opts?.align,
    spacing: opts?.after !== undefined ? { after: opts.after } : undefined,
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size,
        color: opts?.color,
        font: "Arial",
      }),
    ],
  });
}

function pRuns(
  runs: { text: string; bold?: boolean; color?: string }[],
  opts?: { after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] },
): Paragraph {
  return new Paragraph({
    alignment: opts?.align,
    spacing: opts?.after !== undefined ? { after: opts.after } : undefined,
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold,
          color: r.color,
          font: "Arial",
          size: 22,
        }),
    ),
  });
}

function tableCell(
  paragraphs: Paragraph[],
  shading?: { fill: string },
  widthPct?: number,
): TableCell {
  return new TableCell({
    children: paragraphs,
    shading: shading
      ? { type: ShadingType.CLEAR, fill: shading.fill, color: "auto" }
      : undefined,
    width: widthPct
      ? { size: widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function pageBreakPara(): Paragraph {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

export async function buildReportDocx(
  content: ReportDocumentContent,
  gridImages: (Uint8Array | null)[],
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  const margin = convertInchesToTwip(1);

  // --- Page 1 header ---
  children.push(
    p("PRACTICE VISIBILITY SCAN", {
      bold: true,
      size: 56,
      color: BLUE_900,
      align: AlignmentType.CENTER,
      after: 120,
    }),
  );
  children.push(
    p("Executive Summary", {
      size: 36,
      color: BLUE_500,
      align: AlignmentType.CENTER,
      after: 120,
    }),
  );
  children.push(
    p(content.practiceName, { bold: true, size: 32, align: AlignmentType.CENTER, after: 80 }),
  );
  children.push(
    p(`${content.cityStateLine} (${content.areaDescription})`, {
      size: 24,
      align: AlignmentType.CENTER,
      after: 240,
    }),
  );

  const sc = Math.max(0, Math.min(100, Math.round(content.visibilityScore)));
  children.push(
    p("YOUR VISIBILITY SCORE", {
      bold: true,
      size: 28,
      color: BLUE_900,
      align: AlignmentType.CENTER,
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      shading: {
        type: ShadingType.CLEAR,
        fill: scoreFill(sc),
        color: "auto",
      },
      children: [
        new TextRun({
          text: `${sc} / 100`,
          bold: true,
          size: 72,
          color: BLUE_900,
          font: "Arial",
        }),
      ],
    }),
  );
  children.push(
    p(content.scoreLabel, { size: 28, align: AlignmentType.CENTER, after: 360 }),
  );

  // Strengths / Problems
  const sRows = content.strengths.slice(0, 3);
  const pRows = content.problems.slice(0, 3);
  const maxRows = Math.max(sRows.length, pRows.length, 1);
  const spRows: TableRow[] = [
    new TableRow({
      children: [
        tableCell([p("Strengths", { bold: true, color: BLUE_900 })], { fill: GREEN_HEAD }, 50),
        tableCell([p("Problems", { bold: true, color: BLUE_900 })], { fill: RED_HEAD }, 50),
      ],
    }),
  ];
  for (let i = 0; i < maxRows; i++) {
    const sl = sRows[i];
    const pl = pRows[i];
    const left = sl
      ? pRuns(
          [
            { text: `${sl.title} — `, bold: true, color: BLUE_900 },
            { text: sl.body, bold: false },
          ],
          { after: 120 },
        )
      : p("—");
    const right = pl
      ? pRuns(
          [
            { text: `${pl.title} — `, bold: true, color: BLUE_900 },
            { text: pl.body, bold: false },
          ],
          { after: 120 },
        )
      : p("—");
    spRows.push(
      new TableRow({
        children: [tableCell([left], undefined, 50), tableCell([right], undefined, 50)],
      }),
    );
  }
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: spRows,
    }),
  );

  children.push(pageBreakPara());

  // --- Where patients find you ---
  children.push(
    p("Where Patients Find You on Google", {
      bold: true,
      size: 48,
      color: BLUE_900,
      after: 200,
    }),
  );
  children.push(p(content.scanIntro, { after: 200, size: 22 }));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            tableCell([p(content.legendGreen, { size: 20 })], { fill: "C8E6C9" }, 34),
            tableCell([p(content.legendYellow, { size: 20 })], { fill: "FFE0B2" }, 33),
            tableCell([p(content.legendRed, { size: 20 })], { fill: "FFCDD2" }, 33),
          ],
        }),
      ],
    }),
  );
  children.push(p("", { after: 200 }));

  const kw = content.keywordSections;
  for (let i = 0; i < kw.length; i++) {
    const block = kw[i];
    children.push(
      p(`Keyword: ${block.keyword}`, { bold: true, size: 48, color: BLUE_900, after: 80 }),
    );
    children.push(
      p(block.statsLine, { bold: true, size: 40, color: BLUE_500, after: 120 }),
    );
    children.push(p(block.analysis, { size: 22, after: 160 }));

    const imgBuf = gridImages[i] ?? null;
    if (imgBuf && imgBuf.byteLength > 0) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new ImageRun({
              type: "png",
              data: imgBuf,
              transformation: { width: 468, height: 468 },
            }),
          ],
        }),
      );
    } else {
      children.push(
        p(`[INSERT GRID IMAGE: ${block.keyword}]`, {
          size: 20,
          color: BLUE_500,
          align: AlignmentType.CENTER,
          after: 200,
        }),
      );
    }
  }

  // Bottom line box
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 12, color: BLUE_500 },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE_500 },
        left: { style: BorderStyle.SINGLE, size: 12, color: BLUE_500 },
        right: { style: BorderStyle.SINGLE, size: 12, color: BLUE_500 },
      },
      rows: [
        new TableRow({
          children: [
            tableCell(
              [
                pRuns(
                  [
                    { text: "Bottom Line: ", bold: true, color: BLUE_900 },
                    { text: content.bottomLine, bold: false },
                  ],
                  { after: 0 },
                ),
              ],
              { fill: BLUE_100 },
              100,
            ),
          ],
        }),
      ],
    }),
  );

  children.push(pageBreakPara());

  // Detailed findings
  children.push(
    p("DETAILED FINDINGS", { bold: true, size: 48, color: BLUE_900, align: AlignmentType.CENTER, after: 240 }),
  );

  const pi = content.practiceInfo;
  const infoRows = [
    ["Practice Name", pi.practiceName],
    ["Doctor Name", pi.doctorName],
    ["Website", pi.website],
    ["Location(s)", pi.locations],
    ["Report Date", pi.reportDate],
  ].map(
    ([label, val]) =>
      new TableRow({
        children: [
          tableCell([p(label, { bold: true })], { fill: BLUE_100 }, 35),
          tableCell([p(val, { size: 22 })], undefined, 65),
        ],
      }),
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: infoRows,
    }),
  );
  children.push(p("", { after: 240 }));

  const scoreHeader = new TableRow({
    children: [
      tableCell([p("Category", { bold: true, color: "FFFFFF" })], { fill: BLUE_900 }, 50),
      tableCell([p("Score", { bold: true, color: "FFFFFF" })], { fill: BLUE_900 }, 25),
      tableCell([p("Status", { bold: true, color: "FFFFFF" })], { fill: BLUE_900 }, 25),
    ],
  });
  const scoreBody = content.scoreSummary.map(
    (row) =>
      new TableRow({
        children: [
          tableCell([p(row.category, { size: 22 })], undefined, 50),
          tableCell(
            [p(String(row.score), { bold: true, size: 22 })],
            { fill: scoreFill(row.score) },
            25,
          ),
          tableCell([p(row.status, { bold: true, size: 22, color: "FFFFFF" })], { fill: BLUE_500 }, 25),
        ],
      }),
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [scoreHeader, ...scoreBody],
    }),
  );

  children.push(p("", { after: 280 }));

  // Demographics
  children.push(
    p("The Demographic Opportunity", { bold: true, size: 64, color: BLUE_900, after: 200 }),
  );
  children.push(p(content.demographicsIntro, { size: 22, after: 200 }));

  const incHeader = new TableRow({
    children: [
      tableCell([p("Neighborhood", { bold: true, color: "FFFFFF" })], { fill: BLUE_900 }, 50),
      tableCell([p("Median Household Income", { bold: true, color: "FFFFFF" })], { fill: BLUE_900 }, 50),
    ],
  });
  const incBody = content.incomeRows.map(
    (row) =>
      new TableRow({
        children: [
          tableCell(
            [p(row.neighborhood, { bold: row.highlightPracticeRow, size: 22 })],
            row.highlightPracticeRow ? { fill: BLUE_LIGHT } : undefined,
            50,
          ),
          tableCell(
            [p(row.income, { bold: true, color: "2E7D32", size: 22 })],
            undefined,
            50,
          ),
        ],
      }),
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [incHeader, ...incBody],
    }),
  );
  children.push(p(content.demographicsAnalysis, { size: 22, after: 200 }));

  children.push(pageBreakPara());

  // Summary
  children.push(
    p("SUMMARY", { bold: true, size: 48, color: BLUE_900, align: AlignmentType.CENTER, after: 240 }),
  );
  children.push(p("General Observations", { bold: true, size: 52, color: BLUE_900, after: 120 }));

  const goParas: Paragraph[] = [];
  for (const o of content.generalObservations) {
    goParas.push(
      pRuns(
        [
          { text: `${o.title} — `, bold: true, color: BLUE_900 },
          { text: o.body, bold: false },
        ],
        { after: 200 },
      ),
    );
  }
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: GRAY_BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: GRAY_BORDER },
        left: { style: BorderStyle.SINGLE, size: 6, color: GRAY_BORDER },
        right: { style: BorderStyle.SINGLE, size: 6, color: GRAY_BORDER },
      },
      rows: [new TableRow({ children: [tableCell(goParas.length ? goParas : [p("—")], { fill: BLUE_LIGHT }, 100)] })],
    }),
  );

  children.push(p("Critical Observations", { bold: true, size: 52, color: RED, after: 200 }));

  const coParas: Paragraph[] = [];
  for (const o of content.criticalObservations) {
    coParas.push(
      pRuns(
        [
          { text: `${o.title} — `, bold: true, color: RED },
          { text: o.body, bold: false },
        ],
        { after: 200 },
      ),
    );
  }
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 18, color: RED },
        bottom: { style: BorderStyle.SINGLE, size: 18, color: RED },
        left: { style: BorderStyle.SINGLE, size: 18, color: RED },
        right: { style: BorderStyle.SINGLE, size: 18, color: RED },
      },
      rows: [new TableRow({ children: [tableCell(coParas.length ? coParas : [p("—")], { fill: RED_LIGHT }, 100)] })],
    }),
  );

  children.push(p("", { after: 360 }));

  // CTA
  children.push(
    p(content.ctaHeadline, {
      bold: true,
      size: 64,
      color: BLUE_900,
      align: AlignmentType.CENTER,
      after: 160,
    }),
  );
  children.push(
    p(content.ctaContactLine, { size: 52, color: BLUE_500, align: AlignmentType.CENTER, after: 120 }),
  );
  children.push(
    p(content.ctaScheduleLine, { size: 52, color: BLUE_500, align: AlignmentType.CENTER }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: margin, right: margin, bottom: margin, left: margin },
            size: {
              width: convertInchesToTwip(8.5),
              height: convertInchesToTwip(11),
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
