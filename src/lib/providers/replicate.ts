import Replicate from "replicate";
import { secret } from "../settings";
import {
  ProviderError,
  type ControlMode,
  type ProgressHandler,
  type RenderOutcome,
  type RenderParams,
  type RenderProvider,
} from "./types";

/**
 * Replicate fallback. Uses Black Forest Labs' official FLUX Tools models, which
 * expose the same Canny/Depth structure conditioning as the fal endpoints.
 */
const MODELS: Record<ControlMode, string> = {
  canny:
    process.env.REPLICATE_MODEL_CANNY ?? "black-forest-labs/flux-canny-dev",
  depth:
    process.env.REPLICATE_MODEL_DEPTH ?? "black-forest-labs/flux-depth-dev",
  none: process.env.REPLICATE_MODEL_IMG2IMG ?? "black-forest-labs/flux-dev",
};

export const replicateProvider: RenderProvider = {
  id: "replicate",
  label: "FLUX Tools (Replicate)",
  blurb: "Phương án dự phòng khi fal.ai gặp sự cố. Cùng dòng FLUX ControlNet.",
  supportsControlNet: true,
  promptStyle: "describe",
  apiKeyUrl: "https://replicate.com/account/api-tokens",
  apiKeyEnv: "REPLICATE_API_TOKEN",

  isConfigured() {
    return Boolean(secret("REPLICATE_API_TOKEN"));
  },

  modelFor(mode) {
    return MODELS[mode];
  },

  /** Replicate accepts `data:` URIs directly for image inputs. */
  async prepareImage(buffer: Buffer, mime: string): Promise<string> {
    return `data:${mime};base64,${buffer.toString("base64")}`;
  },

  async render(
    params: RenderParams,
    onProgress?: ProgressHandler,
  ): Promise<RenderOutcome> {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new ProviderError(
        "Chưa có REPLICATE_API_TOKEN. Thêm vào .env.local rồi khởi động lại dev server.",
        "replicate",
      );
    }

    const replicate = new Replicate({ auth: token });
    const model = MODELS[params.controlMode] as `${string}/${string}`;

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      num_inference_steps: params.steps,
      guidance: params.guidanceScale,
      num_outputs: params.numImages,
      output_format: params.outputFormat,
      // Replicate's FLUX models take a megapixel bucket rather than explicit
      // dimensions; "1" is ~1024px on the long side, "0.25" is ~512px.
      megapixels: params.maxSide > 1200 ? "1" : "0.25",
      disable_safety_checker: true,
    };

    if (params.controlMode === "none") {
      input.image = params.imageUrl;
      input.prompt_strength = params.strength;
    } else {
      // FLUX Canny/Depth dev take the structure reference as `control_image`.
      input.control_image = params.imageUrl;
      input.guidance = params.guidanceScale;
    }

    if (typeof params.seed === "number") input.seed = params.seed;

    onProgress?.({ type: "queued" });

    try {
      const output = await replicate.run(model, { input });
      const urls = await toUrls(output);

      if (urls.length === 0) {
        throw new ProviderError("Replicate không trả về ảnh nào.", "replicate");
      }

      onProgress?.({ type: "completed" });

      return {
        model,
        seed: params.seed,
        images: urls.map((url) => ({
          url,
          width: params.imageSize.width,
          height: params.imageSize.height,
          contentType: `image/${params.outputFormat}`,
        })),
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new ProviderError(
        `Lỗi từ Replicate (${model}): ${message}`,
        "replicate",
        error,
      );
    }
  },
};

/**
 * `replicate.run` returns either plain URL strings or FileOutput objects
 * (which expose `.url()`), and either a single value or an array.
 */
async function toUrls(output: unknown): Promise<string[]> {
  const items = Array.isArray(output) ? output : [output];
  const urls: string[] = [];

  for (const item of items) {
    if (typeof item === "string") {
      urls.push(item);
      continue;
    }
    const asUrl = (item as { url?: () => URL | string })?.url;
    if (typeof asUrl === "function") {
      urls.push(String(asUrl.call(item)));
    }
  }

  return urls;
}
