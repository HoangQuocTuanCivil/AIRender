/**
 * Proves the guarantee the region-edit feature rests on: after compositing, every
 * pixel outside the painted mask is byte-identical to the original.
 *
 * Run with `npm run check:imaging`. No network, no API key — pure pixel maths.
 */
import sharp from "sharp";
import {
  compositeThroughMask,
  cropTo,
  imageSize,
  maskBounds,
  maskCoverage,
  normaliseMask,
  padBox,
  resizeMaskTo,
  snapBox,
} from "../src/lib/imaging";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`  FAIL: ${msg}`);
};
const ok = (msg: string) => console.log(`  ok: ${msg}`);

const W = 320;
const H = 200;

/** A base image with structure, so a wrong paste is obvious rather than subtle. */
async function makeBase(): Promise<Buffer> {
  const stripes = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      stripes[i] = (x * 7) % 256;
      stripes[i + 1] = (y * 11) % 256;
      stripes[i + 2] = ((x + y) * 3) % 256;
    }
  }
  return sharp(stripes, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer();
}

/** Mask with one white rectangle; everything else black. */
async function makeMask(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}): Promise<Buffer> {
  const white = await sharp({
    create: {
      width: rect.width,
      height: rect.height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([{ input: white, left: rect.left, top: rect.top }])
    .png()
    .toBuffer();
}

async function raw(buffer: Buffer) {
  return sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function main() {
  const base = await makeBase();
  const RECT = { left: 80, top: 50, width: 60, height: 40 };
  const mask = await makeMask(RECT);

  // --- bounds -------------------------------------------------------------
  const bounds = await maskBounds(mask);
  if (!bounds) {
    fail("maskBounds returned null for a painted mask");
    process.exit(1);
  }
  if (
    bounds.left !== RECT.left ||
    bounds.top !== RECT.top ||
    bounds.width !== RECT.width ||
    bounds.height !== RECT.height
  ) {
    fail(`maskBounds ${JSON.stringify(bounds)} != ${JSON.stringify(RECT)}`);
  } else {
    ok("maskBounds finds the painted rectangle exactly");
  }

  if ((await maskBounds(await makeMask({ left: 0, top: 0, width: 1, height: 1 }))) === null)
    fail("a single painted pixel should still produce bounds");

  const blank = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  if ((await maskBounds(blank)) !== null) fail("an unpainted mask must give null bounds");
  else ok("an unpainted mask gives null, so the caller can refuse the job");

  // --- padding and snapping ----------------------------------------------
  const size = await imageSize(base);
  const padded = snapBox(padBox(bounds, size), size);
  if (
    padded.left > bounds.left ||
    padded.top > bounds.top ||
    padded.left + padded.width < bounds.left + bounds.width ||
    padded.top + padded.height < bounds.top + bounds.height
  ) {
    fail(`padded box ${JSON.stringify(padded)} does not contain the mask`);
  } else {
    ok("padded box still contains the whole painted region");
  }
  if (
    padded.left < 0 ||
    padded.top < 0 ||
    padded.left + padded.width > W ||
    padded.top + padded.height > H
  ) {
    fail("padded box escapes the image bounds");
  } else {
    ok("padded box stays inside the image");
  }
  if (padded.width % 16 !== 0 || padded.height % 16 !== 0)
    fail(`snapped box ${padded.width}x${padded.height} is not on the 16px grid`);
  else ok("crop dimensions land on the latent grid");

  // --- the actual guarantee ----------------------------------------------
  // Stand in for the model: return the crop painted solid magenta, so any pixel
  // that leaks outside the mask is unmistakable.
  const crop = await cropTo(base, padded);
  const edited = await sharp({
    create: {
      width: padded.width,
      height: padded.height,
      channels: 3,
      background: { r: 255, g: 0, b: 255 },
    },
  })
    .png()
    .toBuffer();

  const result = await compositeThroughMask({
    base,
    edited,
    mask,
    box: padded,
    feather: 0, // exact comparison; feathering is checked separately below
  });

  const a = await raw(base);
  const b = await raw(result);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    fail("composite changed the image dimensions");
  }

  let changedOutside = 0;
  let changedInside = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const differs =
        a.data[i] !== b.data[i] ||
        a.data[i + 1] !== b.data[i + 1] ||
        a.data[i + 2] !== b.data[i + 2];
      const insideMask =
        x >= RECT.left &&
        x < RECT.left + RECT.width &&
        y >= RECT.top &&
        y < RECT.top + RECT.height;
      if (differs && !insideMask) changedOutside++;
      if (differs && insideMask) changedInside++;
    }
  }

  if (changedOutside !== 0)
    fail(`${changedOutside} pixels changed OUTSIDE the mask — the guarantee is broken`);
  else ok("zero pixels changed outside the mask");

  const insideTotal = RECT.width * RECT.height;
  if (changedInside < insideTotal * 0.95)
    fail(`only ${changedInside}/${insideTotal} pixels changed inside the mask`);
  else ok(`${changedInside}/${insideTotal} pixels changed inside the mask`);

  // Crop must be the region actually asked for.
  const cropSize = await imageSize(crop);
  if (cropSize.width !== padded.width || cropSize.height !== padded.height)
    fail("cropTo returned the wrong size");
  else ok("cropTo returns exactly the padded box");

  // --- feathering ---------------------------------------------------------
  const feathered = await compositeThroughMask({
    base,
    edited,
    mask,
    box: padded,
    feather: 4,
  });
  const f = await raw(feathered);
  let bled = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const insideMask =
        x >= RECT.left &&
        x < RECT.left + RECT.width &&
        y >= RECT.top &&
        y < RECT.top + RECT.height;
      // Feathering deliberately bleeds a few pixels past the edge; it must not
      // reach the far side of the image.
      const nearEdge =
        x >= RECT.left - 12 &&
        x < RECT.left + RECT.width + 12 &&
        y >= RECT.top - 12 &&
        y < RECT.top + RECT.height + 12;
      if (!insideMask && !nearEdge) {
        if (
          a.data[i] !== f.data[i] ||
          a.data[i + 1] !== f.data[i + 1] ||
          a.data[i + 2] !== f.data[i + 2]
        )
          bled++;
      }
    }
  }
  if (bled !== 0) fail(`feathering leaked ${bled} pixels well beyond the mask edge`);
  else ok("feathering stays within a few pixels of the mask edge");

  // --- coverage and rescaling --------------------------------------------
  const coverage = await maskCoverage(mask);
  const expected = (RECT.width * RECT.height) / (W * H);
  if (Math.abs(coverage - expected) > 0.005)
    fail(`maskCoverage ${coverage.toFixed(4)} != expected ${expected.toFixed(4)}`);
  else ok(`maskCoverage reports ${(coverage * 100).toFixed(1)}% of the frame`);

  // A mask painted on a half-size preview must land on the same region.
  const halfMask = await sharp(mask).resize(W / 2, H / 2).png().toBuffer();
  const rescaled = await resizeMaskTo(halfMask, { width: W, height: H });
  const rb = await maskBounds(rescaled);
  if (!rb || Math.abs(rb.left - RECT.left) > 3 || Math.abs(rb.top - RECT.top) > 3)
    fail(`rescaled mask landed at ${JSON.stringify(rb)}, expected near ${JSON.stringify(RECT)}`);
  else ok("a mask painted on a smaller preview rescales onto the same region");

  // --- normalisation ------------------------------------------------------
  const norm = await normaliseMask(mask, padded);
  const normSize = await imageSize(norm);
  if (normSize.width !== padded.width || normSize.height !== padded.height)
    fail("normaliseMask did not crop to the box");
  else ok("normaliseMask crops to the box the engine will receive");

  const normRaw = await sharp(norm).raw().toBuffer();
  const midtones = [...normRaw].filter((v) => v > 8 && v < 247).length;
  if (midtones > 0)
    fail(`normalised mask has ${midtones} grey pixels — must be pure black/white`);
  else ok("normalised mask is pure black and white");

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main();
