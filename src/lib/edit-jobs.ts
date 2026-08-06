import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import { APP_NAME } from "./brand";
import {
  brandImage,
  compositeThroughMask,
  cropTo,
  imageSize,
  maskBounds,
  maskCoverage,
  normaliseMask,
  padBox,
  resizeMaskTo,
  snapBox,
} from "./imaging";
import {
  JOB_DEADLINE_MS,
  clearLiveJob,
  getLiveJob,
  registerAbort,
  releaseAbort,
  setLiveJob,
} from "./jobs";
import {
  ProviderError,
  RenderCancelledError,
  resolveProvider,
} from "./providers";
import { translateToEnglish } from "./translate";
import {
  RENDERS_DIR,
  readStoredFile,
  saveBuffer,
  saveRemoteImage,
} from "./storage";

/**
 * Region editing: repaint only what the user painted over, leave the rest byte
 * for byte as it was.
 *
 * The guarantee comes from `compositeThroughMask`, not from the engine. Even
 * FLUX Fill, which does take a mask, returns a freshly encoded frame; and the
 * engine that works best here (Nano Banana) takes no mask at all. So the flow is
 * always: crop the region with context → let the engine repaint that crop →
 * paste it back through the mask. Pixels outside the mask are copied from the
 * parent image and never pass through a model.
 */

export interface RegionEditInput {
  /** Render whose output is being corrected. */
  parentId: string;
  /** Which output of the parent, when it produced several. */
  outputIndex: number;
  /** Storage path of the uploaded mask, white where the edit applies. */
  maskPath: string;
  /** What the user typed — Vietnamese is fine. */
  instruction: string;
  providerId?: string;
  outputFormat?: "jpeg" | "png";
  seed?: number;
}

/** Refuse a mask so large the edit is really a re-render. */
const MAX_COVERAGE = 0.9;

export async function startRegionEdit(input: RegionEditInput): Promise<string> {
  const parent = await prisma.render.findUnique({
    where: { id: input.parentId },
  });
  if (!parent) {
    throw new ProviderError("Không tìm thấy ảnh gốc để sửa.", "none");
  }

  let parentOutputs: string[] = [];
  try {
    parentOutputs = JSON.parse(parent.outputPaths) as string[];
  } catch {
    parentOutputs = [];
  }
  const basePath = parentOutputs[input.outputIndex];
  if (!basePath) {
    throw new ProviderError(
      "Ảnh gốc chưa có kết quả render để sửa.",
      "none",
    );
  }

  const provider = resolveProvider(input.providerId);
  if (!provider.isConfigured()) {
    throw new ProviderError(
      `Engine "${provider.label}" chưa có API key. Thêm ở mục Cài đặt.`,
      provider.id,
    );
  }

  const id = randomUUID();
  const outputFormat = input.outputFormat ?? "png";

  await prisma.render.create({
    data: {
      id,
      status: "pending",
      provider: provider.id,
      model: provider.modelFor("none"),
      controlMode: "none",
      parentId: parent.id,
      maskPath: input.maskPath,
      editInstruction: input.instruction,
      presetId: parent.presetId,
      contextId: parent.contextId,
      lightingId: parent.lightingId,
      prompt: input.instruction,
      extraDetails: parent.extraDetails,
      lanesPerDirection: parent.lanesPerDirection,
      controlStrength: parent.controlStrength,
      strength: parent.strength,
      guidanceScale: parent.guidanceScale,
      steps: parent.steps,
      numImages: 1,
      seed: input.seed != null ? String(input.seed) : null,
      width: parent.width,
      height: parent.height,
      maxSide: parent.maxSide,
      outputFormat,
      // The parent's render is this job's input, so the "source" shown in the
      // before/after slider is the image being corrected.
      sourcePath: basePath,
      outputPaths: "[]",
    },
  });

  registerAbort(id);
  setLiveJob(id, {
    id,
    status: "pending",
    message: "Đang đọc vùng khoanh…",
    startedAt: Date.now(),
  });

  void processRegionEdit(id, input, basePath, provider).catch((error) => {
    console.error(`[edit ${id}] uncaught`, error);
  });

  return id;
}

async function processRegionEdit(
  id: string,
  input: RegionEditInput,
  basePath: string,
  provider: ReturnType<typeof resolveProvider>,
) {
  const startedAt = Date.now();
  const controller = registerAbort(id);
  const signal = controller.signal;
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, JOB_DEADLINE_MS);
  deadline.unref?.();

  const say = (message: string) => {
    const current = getLiveJob(id);
    if (current) setLiveJob(id, { ...current, status: "running", message });
  };

  try {
    await prisma.render.update({ where: { id }, data: { status: "running" } });
    say("Đang đọc vùng khoanh…");

    const base = await readStoredFile(basePath);
    const size = await imageSize(base);

    // A mask painted on a scaled preview must be stretched to the real frame
    // before anything is measured, or the region lands in the wrong place.
    const mask = await resizeMaskTo(await readStoredFile(input.maskPath), size);

    const bounds = await maskBounds(mask);
    if (!bounds) {
      throw new ProviderError(
        "Chưa khoanh vùng nào. Hãy tô vùng cần sửa rồi thử lại.",
        provider.id,
      );
    }

    const coverage = await maskCoverage(mask);
    if (coverage > MAX_COVERAGE) {
      throw new ProviderError(
        `Vùng khoanh chiếm ${Math.round(coverage * 100)}% khung hình — gần như cả ảnh. ` +
          `Nên render lại toàn bộ thay vì sửa vùng.`,
        provider.id,
      );
    }

    const box = snapBox(padBox(bounds, size), size);
    say("Đang cắt vùng cần sửa…");
    const crop = await cropTo(base, box);

    // Translate only when the engine needs it. Nano Banana follows Vietnamese
    // directly, verified live, so skipping saves a call and a mistranslation.
    let promptEn = input.instruction;
    if (!provider.understandsVietnamese) {
      say("Đang dịch câu lệnh sang tiếng Anh…");
      promptEn = await translateToEnglish(input.instruction);
      await prisma.render.update({
        where: { id },
        data: { editInstructionEn: promptEn },
      });
    }

    say("Đang gửi vùng cho engine…");
    const imageUrl = await provider.prepareImage(crop, "image/png");

    let maskUrl: string | undefined;
    if (provider.supportsMask) {
      // The engine gets the mask cropped to the same box, so its coordinates
      // line up with the crop it is repainting.
      const cropMask = await normaliseMask(mask, box);
      maskUrl = await provider.prepareImage(cropMask, "image/png");
    }

    const outcome = await provider.render(
      {
        imageUrl,
        maskUrl,
        prompt: buildEditPrompt(promptEn, Boolean(provider.supportsMask)),
        controlMode: "none",
        controlStrength: 0,
        strength: 0.95,
        guidanceScale: 3.5,
        steps: 30,
        numImages: 1,
        seed: input.seed,
        imageSize: { width: box.width, height: box.height },
        maxSide: Math.max(box.width, box.height),
        outputFormat: "png",
        signal,
      },
      (event) => {
        if (event.type === "queued") {
          say(
            typeof event.position === "number"
              ? `Đang xếp hàng (vị trí ${event.position})…`
              : "Đang xếp hàng trên server…",
          );
        } else if (event.type === "progress") {
          say(event.message);
        }
      },
    );

    say("Đang ghép vùng đã sửa vào ảnh gốc…");

    // Fetch the model's crop, then composite. This is the step that makes
    // "outside the region is unchanged" true rather than hoped for.
    const editedPath = await saveRemoteImage(
      RENDERS_DIR,
      outcome.images[0].url,
      outcome.images[0].contentType,
      `${id}-crop`,
    );
    const edited = await readStoredFile(editedPath);

    const composited = await compositeThroughMask({
      base,
      edited,
      mask,
      box,
    });

    const branded = await brandImage(composited, "png", {
      software: APP_NAME,
      description: input.instruction.slice(0, 300),
    });
    const finalPath = await saveBuffer(RENDERS_DIR, branded, "image/png", `${id}-0`);

    await prisma.render.update({
      where: { id },
      data: {
        status: "succeeded",
        outputPaths: JSON.stringify([finalPath]),
        model: outcome.model,
        editBox: JSON.stringify(box),
        durationMs: Date.now() - startedAt,
      },
    });

    const current = getLiveJob(id);
    if (current) setLiveJob(id, { ...current, status: "succeeded", message: "Hoàn tất" });
  } catch (error) {
    const cancelled = signal.aborted || error instanceof RenderCancelledError;
    const message = cancelled
      ? timedOut
        ? `Quá ${JOB_DEADLINE_MS / 60_000} phút chưa xong nên đã tự dừng.`
        : "Đã huỷ."
      : error instanceof ProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    if (!cancelled) console.error(`[edit ${id}] failed:`, error);

    await prisma.render
      .update({
        where: { id },
        data: {
          status: cancelled ? "cancelled" : "failed",
          error: message,
          durationMs: Date.now() - startedAt,
        },
      })
      .catch(() => {});

    const current = getLiveJob(id);
    if (current) {
      setLiveJob(id, {
        ...current,
        status: cancelled ? "cancelled" : "failed",
        message,
      });
    }
  } finally {
    clearTimeout(deadline);
    releaseAbort(id);
    clearLiveJob(id, 5 * 60_000);
  }
}

/**
 * An edit instruction, not a scene description.
 *
 * Mask-native engines are told the boundary by the mask itself, so telling them
 * again in words only competes with it. Engines without a mask are looking at a
 * crop and need to be told to change one thing and leave the rest.
 */
function buildEditPrompt(instruction: string, hasMask: boolean): string {
  if (hasMask) return instruction;

  return [
    instruction,
    "",
    "Change only what the instruction asks for. Everything else in this image — " +
      "the geometry, materials, lighting direction, colour grading and camera — " +
      "must stay exactly as it is, so the result drops seamlessly back into the " +
      "surrounding photograph.",
  ].join("\n");
}

