import { readFile } from "fs/promises";
import path from "path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { VisibilityReportTemplateData } from "@/lib/pipeline/render-report-content";

const TEMPLATE_REL = path.join(
  "templates",
  "visibility_report_template.docx",
);

/**
 * Legacy image-module tags → plain markers for a second pass (`embedMapsInRenderedDocx` + `docx` `patchDocument`).
 */
function rewriteMapPatchPlaceholders(zip: PizZip): void {
  const docPath = "word/document.xml";
  const f = zip.file(docPath);
  if (!f || f.dir) return;
  let xml = f.asText();
  xml = xml.replace(
    /{%kw1_map%?}/g,
    "[[PRACTICE_SCAN_MAP_KW1]]",
  );
  xml = xml.replace(
    /{%kw2_map%?}/g,
    "[[PRACTICE_SCAN_MAP_KW2]]",
  );
  zip.file(docPath, xml);
}

/**
 * Word ships `{{tag}}` while docxtemplater defaults to `{tag}`; normalize XML.
 */
function normalizeDoubleBracePlaceholders(zip: PizZip): void {
  const names = Object.keys(zip.files);
  for (const n of names) {
    if (!n.startsWith("word/") || !n.endsWith(".xml")) continue;
    const f = zip.file(n);
    if (!f || f.dir) continue;
    let xml = f.asText();
    if (!xml.includes("{{")) continue;
    xml = xml.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
    zip.file(n, xml);
  }
}

/** Build .docx from `templates/visibility_report_template.docx` and template data. */
export async function buildDocxFromTemplate(
  data: VisibilityReportTemplateData,
): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), TEMPLATE_REL);
  const input = await readFile(templatePath);

  const zip = new PizZip(input);
  rewriteMapPatchPlaceholders(zip);
  normalizeDoubleBracePlaceholders(zip);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(data as unknown as Record<string, unknown>);

  const out = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;

  return out;
}
