import { secret } from "../settings";
import {
  fal,
  ensureFalCredentials,
  falErrorMessage,
  uploadToFal,
} from "./fal-shared";
import {
  ProviderError,
  type ProgressHandler,
  type RenderOutcome,
  type RenderParams,
  type RenderProvider,
} from "./types";

/**
 * Google's Nano Banana Pro (Gemini 3 Pro Image backbone), running on fal.
 *
 * Fundamentally different from the FLUX ControlNet path: it receives the source
 * image itself and an edit instruction, rather than a depth/edge map plus a
 * scene description. That matters for infrastructure — monocular depth
 * estimation barely registers thin members, so a depth map of a cable-stayed
 * bridge hands the model a pylon and a deck and lets it invent the entire stay
 * system. An edit model sees the cables.
 *
 * The trade is control: there is no adherence dial, only the wording of the
 * instruction.
 */
const MODEL =
  process.env.FAL_MODEL_NANO_BANANA ?? "fal-ai/nano-banana-pro/edit";

const PROVIDER_ID = "nano-banana";

/** Nano Banana takes a resolution bucket, not pixel dimensions. */
function resolutionBucket(maxSide: number): "1K" | "2K" | "4K" {
  if (maxSide <= 1024) return "1K";
  if (maxSide <= 1600) return "2K";
  return "4K";
}

interface NanoImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface NanoOutput {
  images?: NanoImage[];
  description?: string;
}

export const nanoBananaProvider: RenderProvider = {
  id: PROVIDER_ID,
  label: "Nano Banana Pro (Gemini)",
  blurb: "Giữ nguyên tuyệt đối cấu kiện mảnh — dây văng, cột tiếp xúc, lan can.",
  supportsControlNet: false,
  promptStyle: "instruct",
  apiKeyUrl: "https://fal.ai/dashboard/keys",
  apiKeyEnv: "FAL_KEY",

  isConfigured() {
    return Boolean(secret("FAL_KEY"));
  },

  // No control modes — the source image is the reference, whatever the mode.
  modelFor() {
    return MODEL;
  },

  async prepareImage(buffer, mime) {
    return uploadToFal(buffer, mime, PROVIDER_ID);
  },

  async render(
    params: RenderParams,
    onProgress?: ProgressHandler,
  ): Promise<RenderOutcome> {
    ensureFalCredentials(PROVIDER_ID);

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      image_urls: [params.imageUrl],
      num_images: params.numImages,
      // "auto" keeps the source framing; forcing a ratio would crop or stretch
      // the geometry the render is supposed to match.
      aspect_ratio: "auto",
      resolution: resolutionBucket(params.maxSide),
      output_format: params.outputFormat === "jpeg" ? "jpeg" : "png",
    };

    if (typeof params.seed === "number") input.seed = params.seed;

    try {
      const result = await fal.subscribe(MODEL, {
        input,
        logs: true,
        onQueueUpdate(update) {
          if (update.status === "IN_QUEUE") {
            onProgress?.({
              type: "queued",
              position: (update as { queue_position?: number }).queue_position,
            });
          } else if (update.status === "IN_PROGRESS") {
            const last = update.logs?.at(-1)?.message;
            if (last) onProgress?.({ type: "progress", message: last });
          } else if (update.status === "COMPLETED") {
            onProgress?.({ type: "completed" });
          }
        },
      });

      const data = result.data as NanoOutput;
      const images = data?.images ?? [];
      if (images.length === 0) {
        throw new ProviderError(
          "Nano Banana không trả về ảnh nào. Có thể prompt đã bị bộ lọc an toàn chặn.",
          PROVIDER_ID,
        );
      }

      return {
        model: MODEL,
        seed: params.seed,
        images: images.map((img) => ({
          url: img.url,
          width: img.width ?? params.imageSize.width,
          height: img.height ?? params.imageSize.height,
          contentType: img.content_type ?? `image/${params.outputFormat}`,
        })),
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        falErrorMessage(error, MODEL),
        PROVIDER_ID,
        error,
      );
    }
  },
};
