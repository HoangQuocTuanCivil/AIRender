import { fal } from "@fal-ai/client";
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

let credentialsConfigured = false;

function ensureCredentials() {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new ProviderError(
      "Chưa có FAL_KEY. Thêm vào file .env.local rồi khởi động lại dev server.",
      "fal",
    );
  }
  if (!credentialsConfigured) {
    fal.config({ credentials: key });
    credentialsConfigured = true;
  }
}

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
  label: "fal.ai (FLUX.1 dev)",
  apiKeyUrl: "https://fal.ai/dashboard/keys",
  apiKeyEnv: "FAL_KEY",

  isConfigured() {
    return Boolean(process.env.FAL_KEY);
  },

  modelFor(mode) {
    return MODELS[mode];
  },

  /**
   * Upload to fal's CDN rather than inlining base64: a 4K facade screenshot is
   * ~8 MB, and the same URL gets reused for both `image_url` and
   * `control_lora_image_url` instead of being sent twice.
   */
  async prepareImage(buffer: Buffer, mime: string): Promise<string> {
    ensureCredentials();
    try {
      const ext = mime.split("/")[1] ?? "png";
      const file = new File([new Uint8Array(buffer)], `source.${ext}`, {
        type: mime,
      });
      return await fal.storage.upload(file);
    } catch (error) {
      throw new ProviderError(
        `Không upload được ảnh lên fal.ai: ${
          error instanceof Error ? error.message : String(error)
        }`,
        "fal",
        error,
      );
    }
  },

  async render(
    params: RenderParams,
    onProgress?: ProgressHandler,
  ): Promise<RenderOutcome> {
    ensureCredentials();

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

/** fal validation errors nest the useful part; surface it instead of "[object Object]". */
function falErrorMessage(error: unknown, model: string): string {
  const body = (error as { body?: unknown })?.body;
  const detail = (body as { detail?: unknown })?.detail;

  if (Array.isArray(detail)) {
    const parts = detail
      .map((d: { loc?: unknown[]; msg?: string }) =>
        [d.loc?.join("."), d.msg].filter(Boolean).join(": "),
      )
      .filter(Boolean);
    if (parts.length) return `fal.ai từ chối request (${model}): ${parts.join("; ")}`;
  }
  if (typeof detail === "string") {
    return `fal.ai từ chối request (${model}): ${detail}`;
  }

  const status = (error as { status?: number })?.status;
  if (status === 401 || status === 403) {
    return "FAL_KEY không hợp lệ hoặc hết hạn. Kiểm tra lại key ở fal.ai/dashboard/keys.";
  }
  if (status === 402) {
    return "Tài khoản fal.ai hết credit. Nạp thêm ở fal.ai/dashboard/billing.";
  }
  if (status === 404) {
    return `Không tìm thấy model "${model}". Slug có thể đã đổi — set lại qua biến môi trường FAL_MODEL_*.`;
  }

  const message = error instanceof Error ? error.message : String(error);
  return `Lỗi từ fal.ai (${model}): ${message}`;
}
