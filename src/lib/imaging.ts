import sharp from "sharp";

/**
 * Image operations for region editing.
 *
 * The guarantee the user actually asked for — "everything outside the drawn
 * region stays exactly as it is" — is produced *here*, not by the model. Even a
 * true inpainting model returns a freshly encoded image whose untouched areas
 * differ slightly, and the engine that works best for this project (Nano Banana)
 * accepts no mask at all. So the pipeline always composites the model's output
 * back through the mask, and pixels outside it are copied from the original.
 *
 * Server-only: sharp is a native module. Never import this from a client
 * component — see the client/server boundary note in AGENTS.md.
 */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export async function imageSize(buffer: Buffer): Promise<ImageSize> {
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Không đọc được kích thước ảnh.");
  }
  return { width: meta.width, height: meta.height };
}

/**
 * Bounding box of the painted area of a mask.
 *
 * The mask arrives as an opaque PNG where the painted region is white. Reading
 * it here rather than trusting a box sent by the browser keeps the server the
 * authority on what actually gets edited: a client could otherwise claim a small
 * box while painting a large area, and the composite would disagree with the crop.
 */
export async function maskBounds(
  maskBuffer: Buffer,
  threshold = 128,
): Promise<Box | null> {
  const { data, info } = await sharp(maskBuffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y++) {
    const row = y * info.width;
    for (let x = 0; x < info.width; x++) {
      if (data[row + x] >= threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Grow a box by a fraction of its size and clamp it to the image.
 *
 * Context is what makes the edit blend: handing the model only the painted
 * pixels gives it nothing to match the surrounding lighting and materials
 * against, and the seam shows. A minimum in pixels matters too — a 20px scribble
 * grown by 15% is still 23px, far too small for any model to work with.
 */
export function padBox(
  box: Box,
  size: ImageSize,
  fraction = 0.35,
  minPad = 96,
): Box {
  const padX = Math.max(minPad, Math.round(box.width * fraction));
  const padY = Math.max(minPad, Math.round(box.height * fraction));

  const left = Math.max(0, box.left - padX);
  const top = Math.max(0, box.top - padY);
  const right = Math.min(size.width, box.left + box.width + padX);
  const bottom = Math.min(size.height, box.top + box.height + padY);

  return { left, top, width: right - left, height: bottom - top };
}

/** Models want dimensions on the latent grid; odd crops get letterboxed or resized. */
export function snapBox(box: Box, size: ImageSize, multiple = 16): Box {
  const w = Math.max(multiple, Math.round(box.width / multiple) * multiple);
  const h = Math.max(multiple, Math.round(box.height / multiple) * multiple);
  return {
    left: Math.max(0, Math.min(box.left, size.width - w)),
    top: Math.max(0, Math.min(box.top, size.height - h)),
    width: Math.min(w, size.width),
    height: Math.min(h, size.height),
  };
}

export async function cropTo(buffer: Buffer, box: Box): Promise<Buffer> {
  return sharp(buffer).extract(box).png().toBuffer();
}

/**
 * Normalise a painted mask to what inpainting endpoints expect.
 *
 * `white` is the region to repaint. fal's docs for flux-pro/v1/fill and
 * flux-lora/inpainting do not state the polarity, so it was measured: an edit
 * through fal-ai/flux-pro/v1/fill with a white ellipse over the sky changed
 * 92.5% of the pixels inside the ellipse and 25% outside it — white is what gets
 * repainted. Kept behind a flag so an endpoint that ever disagrees is a one-line
 * fix rather than a hunt through the call sites.
 *
 * The 25% is worth remembering: even a mask-native model rewrites a quarter of
 * the area it was told to leave alone. That is why `compositeThroughMask` exists.
 */
export const MASK_WHITE_MEANS_REPAINT = true;

export async function normaliseMask(
  maskBuffer: Buffer,
  box?: Box,
): Promise<Buffer> {
  let pipeline = sharp(maskBuffer).greyscale();
  if (box) pipeline = pipeline.extract(box);
  if (!MASK_WHITE_MEANS_REPAINT) pipeline = pipeline.negate();
  // Hard black/white: a soft mask makes some endpoints edit faintly over a wide
  // area instead of firmly inside the region.
  return pipeline.threshold(128).png().toBuffer();
}

/**
 * Paste an edited crop back over the original, blending only across the mask
 * edge so the join is invisible.
 *
 * `blur` softens the mask, which produces a gradient a few pixels wide at the
 * boundary — inside stays fully the new image, outside stays fully the original,
 * and only the seam mixes. Without it the edit ends on a visible hard line.
 */
export async function compositeThroughMask({
  base,
  edited,
  mask,
  box,
  feather = 4,
}: {
  /** The full original image. */
  base: Buffer;
  /** The model's output for the cropped region, any size. */
  edited: Buffer;
  /** Full-size mask, white where the edit applies. */
  mask: Buffer;
  /** Where the crop came from. */
  box: Box;
  feather?: number;
}): Promise<Buffer> {
  // The model rarely returns the exact crop dimensions it was given.
  const editedAtBoxSize = await sharp(edited)
    .resize(box.width, box.height, { fit: "fill" })
    .toBuffer();

  // Alpha for the edited layer: the mask, cropped to the same box, softened.
  let alphaPipeline = sharp(mask).greyscale().extract(box);
  if (!MASK_WHITE_MEANS_REPAINT) alphaPipeline = alphaPipeline.negate();
  if (feather > 0) alphaPipeline = alphaPipeline.blur(feather);
  const alpha = await alphaPipeline.toBuffer();

  const editedWithAlpha = await sharp(editedAtBoxSize)
    .ensureAlpha()
    .joinChannel(alpha)
    .png()
    .toBuffer();

  // Everything outside the box is never touched: only this rectangle is drawn
  // over, and within it the alpha decides pixel by pixel.
  return sharp(base)
    .composite([{ input: editedWithAlpha, left: box.left, top: box.top }])
    .png()
    .toBuffer();
}

/**
 * Re-encode a finished render carrying this application's own metadata.
 *
 * sharp drops all input metadata unless told otherwise, so this both removes
 * whatever tags the provider attached and stamps the file as ours.
 *
 * What it does NOT do — and must not be believed to do: Gemini image models
 * embed SynthID, an invisible watermark carried in the pixels themselves. No
 * amount of metadata rewriting touches it, and stripping it is not something
 * this pipeline attempts. The file is branded, not laundered.
 */
export async function brandImage(
  buffer: Buffer,
  format: "jpeg" | "png",
  meta: { software: string; artist?: string; description?: string },
): Promise<Buffer> {
  const pipeline = sharp(buffer).withMetadata({
    exif: {
      IFD0: {
        Software: meta.software,
        ...(meta.artist ? { Artist: meta.artist } : {}),
        ...(meta.description ? { ImageDescription: meta.description } : {}),
      },
    },
  });

  return format === "png"
    ? pipeline.png({ compressionLevel: 9 }).toBuffer()
    : // 95 rather than the default 80: this is a deliverable, and it is being
      // re-encoded only to carry the metadata, not to save bytes.
      pipeline.jpeg({ quality: 95, mozjpeg: true }).toBuffer();
}

/** Fraction of the image the mask covers — used to warn about huge selections. */
export async function maskCoverage(maskBuffer: Buffer): Promise<number> {
  const { data, info } = await sharp(maskBuffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let painted = 0;
  for (let i = 0; i < data.length; i++) if (data[i] >= 128) painted++;
  return painted / (info.width * info.height);
}

/**
 * A mask painted on a resized preview must be stretched to the real image, or
 * the region lands somewhere else entirely.
 */
export async function resizeMaskTo(
  maskBuffer: Buffer,
  size: ImageSize,
): Promise<Buffer> {
  const current = await imageSize(maskBuffer);
  if (current.width === size.width && current.height === size.height) {
    return maskBuffer;
  }
  return sharp(maskBuffer)
    .resize(size.width, size.height, { fit: "fill", kernel: "nearest" })
    .png()
    .toBuffer();
}
