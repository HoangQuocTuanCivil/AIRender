import {
  fal,
  ensureFalCredentials,
  falErrorMessage,
  uploadToFal,
} from "./fal-shared";
import {
  ProviderError,
  type ControlMode,
  type ProgressHandler,
  type RenderOutcome,
  type RenderParams,
  type RenderProvider,
} from "./types";

/**
 * Model endpoints are env-overridable because fal rotates slugs faster than we
 * want to cut releases. Defaults verified against fal.ai docs (Aug 2026).
 *
 * The control-LoRA endpoints take BOTH `image_url` (colour/lighting guidance)
 * and `control_lora_image_url` (structure). For architectural work we feed the
 * same source image to both: the geometry comes from the sketch/3D view and the
 * palette is nudged by the same frame.
 */
const MODELS: Record<ControlMode, string> = {
  canny:
    process.env.FAL_MODEL_CANNY ??
    "fal-ai/flux-control-lora-canny/image-to-image",
  depth:
    process.env.FAL_MODEL_DEPTH ??
    "fal-ai/flux-control-lora-depth/image-to-image",
  none: process.env.FAL_MODEL_IMG2IMG ?? "fal-ai/flux/dev/image-to-image",
};

/**
 * Scale to the requested longest side, preserving aspect ratio, snapped to a
 * multiple of 32 (the latent grid). Only ever scales down — upscaling a small
 * source adds no detail and just costs more.
 */
function normaliseSize(width: number, height: number, maxSide: number) {
  const MIN_SIDE = 384;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const snap = (n: number) =>
    Math.max(MIN_SIDE, Math.round((n * scale) / 32) * 32);
  return { width: snap(width), height: snap(height) };
}

interface FalImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface FalOutput {
  images?: FalImage[];
  seed?: number;
}

export const falProvider: RenderProvider = {
  id: "fal",
  label: "FLUX.1 dev + ControlNet",
  blurb: "Có núm vặn độ bám hình khối. Tốt cho khối lớn: đường, hầm, cầu cạn.",
  supportsControlNet: true,
  promptStyle: "describe",
  apiKeyUrl: "https://fal.ai/dashboard/keys",
  apiKeyEnv: "FAL_KEY",

  isConfigured() {
    return Boolean(process.env.FAL_KEY);
  },

  modelFor(mode) {
    return MODELS[mode];
  },

  /** The same uploaded URL feeds both `image_url` and `control_lora_image_url`. */
  async prepareImage(buffer: Buffer, mime: string): Promise<string> {
    return uploadToFal(buffer, mime, "fal");
  },

  async render(
    params: RenderParams,
    onProgress?: ProgressHandler,
  ): Promise<RenderOutcome> {
    ensureFalCredentials("fal");

    const model = MODELS[params.controlMode];
    const size = normaliseSize(
      params.imageSize.width,
      params.imageSize.height,
      params.maxSide,
    );

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      image_url: params.imageUrl,
      image_size: size,
      num_inference_steps: params.steps,
      guidance_scale: params.guidanceScale,
      strength: params.strength,
      num_images: params.numImages,
      output_format: params.outputFormat,
      enable_safety_checker: false,
    };

    if (params.controlMode !== "none") {
      // Structure reference for the control LoRA.
      input.control_lora_image_url = params.imageUrl;
      input.control_lora_strength = params.controlStrength;
    }

    if (typeof params.seed === "number") {
      input.seed = params.seed;
    }

    try {
      const result = await fal.subscribe(model, {
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

      const data = result.data as FalOutput;
      const images = data?.images ?? [];
      if (images.length === 0) {
        throw new ProviderError("fal.ai không trả về ảnh nào.", "fal");
      }

      return {
        model,
        seed: data.seed,
        images: images.map((img) => ({
          url: img.url,
          width: img.width ?? size.width,
          height: img.height ?? size.height,
          contentType: img.content_type ?? `image/${params.outputFormat}`,
        })),
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(falErrorMessage(error, model), "fal", error);
    }
  },
};
