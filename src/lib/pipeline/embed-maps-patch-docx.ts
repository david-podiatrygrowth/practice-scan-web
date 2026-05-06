import imageSize from "image-size";
import {
  ImageRun,
  patchDocument,
  PatchType,
  type IPatch,
  TextRun,
} from "docx";

/** Matches `rewriteMapPatchPlaceholders` in `render-docx-template.ts`. */
export const MAP_PATCH_KEYS = {
  KW1: "PRACTICE_SCAN_MAP_KW1",
  KW2: "PRACTICE_SCAN_MAP_KW2",
} as const;

/** Delimiters deliberately avoid `{{`/`}}` — those are rewritten for docxtemplater elsewhere. */
const PATCH_DELIMS = {
  start: "[[",
  end: "]]",
} as const;

/**
 * docx converts `ImageRun.transformation.{width,height}` → DrawingML extents as px @ 96dpi
 * (each unit × 914400÷96 → EMU Word stores in `cx`/`cy`).
 * Passing EMUs here double-applies that factor and blows up layouts / can break Word.
 *
 * Scale in pixel space ~6″ max width (~576px); keep aspect ratio.
 */
const PX_PER_INCH_96 = 96;
/** ~6½\" usable content width — leaves margin vs Letter 8½\"; docx/demo use the same semantic. */
const MAX_IMAGE_WIDTH_PX = Math.round(6.25 * PX_PER_INCH_96); // 600

function transformationFromPng(data: Buffer): {
  width: number;
  height: number;
} {
  const info = imageSize(data);
  let wPx = info.width ?? 600;
  let hPx = info.height ?? 400;
  if (wPx > MAX_IMAGE_WIDTH_PX && wPx > 0) {
    const s = MAX_IMAGE_WIDTH_PX / wPx;
    wPx = Math.round(wPx * s);
    hPx = Math.round(hPx * s);
  }
  return {
    width: Math.max(1, wPx),
    height: Math.max(1, hPx),
  };
}

function paragraphPatchFromPng(buf: Buffer | null | undefined): IPatch {
  if (!buf?.length) {
    return {
      type: PatchType.PARAGRAPH,
      children: [
        new TextRun({
          text: "Map image unavailable.",
          italics: true,
        }),
      ],
    };
  }
  const t = transformationFromPng(buf);
  return {
    type: PatchType.PARAGRAPH,
    children: [
      new ImageRun({
        type: "png",
        data: buf,
        transformation: t,
      }),
    ],
  };
}

/**
 * Second pass after docxtemplater: replace `[[PRACTICE_SCAN_MAP_KW1]]` / `_KW2_` placeholders with PNGs via `patchDocument`.
 */
export async function embedMapsInRenderedDocx(
  renderedDocx: Buffer,
  maps: { kw1: Buffer | null; kw2: Buffer | null },
): Promise<Buffer> {
  const patches: Record<string, IPatch> = {
    [MAP_PATCH_KEYS.KW1]: paragraphPatchFromPng(maps.kw1),
    [MAP_PATCH_KEYS.KW2]: paragraphPatchFromPng(maps.kw2),
  };

  const out = await patchDocument({
    outputType: "nodebuffer",
    data: renderedDocx,
    placeholderDelimiters: PATCH_DELIMS,
    patches,
    keepOriginalStyles: true,
  });

  return out as Buffer;
}
