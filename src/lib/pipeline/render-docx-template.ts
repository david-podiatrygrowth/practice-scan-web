import { readFile } from "fs/promises";
import path from "path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { mapPatchMarker } from "@/lib/pipeline/embed-maps-patch-docx";
import type { VisibilityReportTemplateData } from "@/lib/pipeline/render-report-content";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "visibility_report_template.docx",
);

/** `{%kw1_map}` legacy tags → `patchDocument` markers (see embed-maps-patch-docx). */
function replaceLegacyMapTags(zip: PizZip): void {
  const pathRel = "word/document.xml";
  const entry = zip.file(pathRel);
  if (!entry || entry.dir) return;

  let xml = entry.asText();

  xml = xml.replace(/\{%kw1_map%?\}/g, mapPatchMarker("KW1"));
  xml = xml.replace(/\{%kw2_map%?\}/g, mapPatchMarker("KW2"));

  zip.file(pathRel, xml);
}

/**
 * Authoring often uses Word `{{field}}`; docxtemplater uses `{field}` unless configured otherwise.
 */
function collapseDoubleBraceTags(zip: PizZip): void {
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith("word/") || !name.endsWith(".xml")) continue;
    const f = zip.file(name);
    if (!f || f.dir) continue;

    let xml = f.asText();
    if (!xml.includes("{{")) continue;

    xml = xml.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
    zip.file(name, xml);
  }
}

function preprocessTemplate(zip: PizZip): void {
  replaceLegacyMapTags(zip);
  collapseDoubleBraceTags(zip);
}

function renderDoc(data: VisibilityReportTemplateData, zip: PizZip): Buffer {
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(data as unknown as Record<string, unknown>);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}

/**
 * Fill `visibility_report_template.docx` from template JSON (maps added in a separate pass).
 */
export async function buildDocxFromTemplate(
  data: VisibilityReportTemplateData,
): Promise<Buffer> {
  const templateBytes = await readFile(TEMPLATE_PATH);
  const zip = new PizZip(templateBytes);
  preprocessTemplate(zip);
  return renderDoc(data, zip);
}
