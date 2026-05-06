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
