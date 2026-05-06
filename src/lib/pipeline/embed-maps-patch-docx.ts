import imageSize from "image-size";
import {
  ImageRun,
  patchDocument,
  PatchType,
  type IPatch,
  TextRun,
} from "docx";

/** Keys referenced by `patchDocument` patches (must stay in sync with OOXML placeholders). */
export const MAP_PATCH_KEYS = {
  KW1: "PRACTICE_SCAN_MAP_KW1",
  KW2: "PRACTICE_SCAN_MAP_KW2",
} as const;

/** Delimiters avoided in docxtemplater’s `{` / `{{` normalization pass. */
const PATCH_DELIMS = { start: "[[", end: "]]" } as const;

const MAP_UNAVAILABLE = "Map image unavailable.";

/**
 * docx expects `ImageRun.transformation` in CSS pixels @ 96dpi; it multiplies by (914400/96) → EMUs.
 * Passing pre-scaled EMU-style numbers doubles that factor (broken Word / oversized layout).
 *
 * Clamp width to ~6.25″ usable content (~600px), preserve aspect ratio.
 */
const DISPLAY_DPI = 96;
const MAX_IMAGE_WIDTH_PX = Math.round(6.25 * DISPLAY_DPI);

export type KeywordMapBuffers = {
  kw1: Buffer | null;
  kw2: Buffer | null;
};

/** `[[PRACTICE_SCAN_MAP_KW1]]` marker written into `document.xml` before docxtemplater. */
export function mapPatchMarker(slot: keyof typeof MAP_PATCH_KEYS): string {
  const id = MAP_PATCH_KEYS[slot];
  return `${PATCH_DELIMS.start}${id}${PATCH_DELIMS.end}`;
}

function imageRunTransformationPx(pngBytes: Buffer): { width: number; height: number } {
  const dim = imageSize(pngBytes);
  let w = dim.width ?? 600;
  let h = dim.height ?? 400;

  if (w > MAX_IMAGE_WIDTH_PX) {
    const scale = MAX_IMAGE_WIDTH_PX / w;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  return {
    width: Math.max(1, w),
    height: Math.max(1, h),
  };
}

function mapImageParagraphPatch(bytes: Buffer | null | undefined): IPatch {
  if (!bytes?.length) {
    return {
      type: PatchType.PARAGRAPH,
      children: [new TextRun({ text: MAP_UNAVAILABLE, italics: true })],
    };
  }

  return {
    type: PatchType.PARAGRAPH,
    children: [
      new ImageRun({
        type: "png",
        data: bytes,
        transformation: imageRunTransformationPx(bytes),
      }),
    ],
  };
}

/** Pass 2: swap `patchDocument` placeholders for fetched map PNGs. */
export async function embedMapsInRenderedDocx(
  renderedDocx: Buffer,
  maps: KeywordMapBuffers,
): Promise<Buffer> {
  const patches: Record<string, IPatch> = {
    [MAP_PATCH_KEYS.KW1]: mapImageParagraphPatch(maps.kw1),
    [MAP_PATCH_KEYS.KW2]: mapImageParagraphPatch(maps.kw2),
  };

  const patched = await patchDocument({
    outputType: "nodebuffer",
    data: renderedDocx,
    placeholderDelimiters: PATCH_DELIMS,
    patches,
    keepOriginalStyles: true,
  });

  return patched as Buffer;
}
