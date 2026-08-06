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
 * FLUX.1 [pro] Fill — the one engine here that takes a real pixel mask and
 * repaints only inside it.
 *
 * The pipeline composites every region edit back through the mask regardless, so
 * this engine is not what makes the guarantee. What it buys is a cleaner seam:
 * a model that knows where the boundary is matches lighting and materials across
 * it, where a model handed only a crop has to be blended in afterwards.
 *
 * It is the only mask-native option available; Nano Banana accepts no mask.
 */
const MODEL = process.env.FAL_MODEL_FILL ?? "fal-ai/flux-pro/v1/fill";

const PROVIDER_ID = "fal-fill";

interface FalImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

export const falFillProvider: RenderProvider = {
  id: PROVIDER_ID,
  label: "FLUX Fill (sửa vùng)",
  blurb: "Nhận vùng khoanh trực tiếp nên mép hoà tốt nhất. Chỉ dùng khi sửa vùng.",
  supportsControlNet: false,
  supportsMask: true,
  editOnly: true,
  understandsVietnamese: false,
  promptStyle: "describe",
  apiKeyUrl: "https://fal.ai/dashboard/keys",
  apiKeyEnv: "FAL_KEY",

  isConfigured() {
    // Shares the one fal credential with the other fal-hosted engines.
    return Boolean(secret("FAL_KEY"));
  },

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

    if (!params.maskUrl) {
      throw new ProviderError(
        "FLUX Fill chỉ dùng được khi sửa theo vùng — cần có vùng khoanh.",
        PROVIDER_ID,
      );
    }

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      image_url: params.imageUrl,
      mask_url: params.maskUrl,
      num_images: params.numImages,
      output_format: params.outputFormat,
      safety_tolerance: "6",
    };

    if (typeof params.seed === "number") input.seed = params.seed;

    onProgress?.({ type: "queued" });

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

      const data = result.data as { images?: FalImage[]; seed?: number };
      const images = data?.images ?? [];
      if (images.length === 0) {
        throw new ProviderError("FLUX Fill không trả về ảnh nào.", PROVIDER_ID);
      }

      return {
        model: MODEL,
        seed: data.seed,
        images: images.map((img) => ({
          url: img.url,
          width: img.width ?? params.imageSize.width,
          height: img.height ?? params.imageSize.height,
          contentType: img.content_type ?? `image/${params.outputFormat}`,
        })),
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(falErrorMessage(error, MODEL), PROVIDER_ID, error);
    }
  },
};
