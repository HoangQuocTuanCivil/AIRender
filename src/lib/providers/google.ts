import { GoogleGenAI } from "@google/genai";
import { secret } from "../settings";
import {
  ProviderError,
  type ProgressHandler,
  type RenderOutcome,
  type RenderParams,
  type RenderProvider,
} from "./types";

/**
 * Nano Banana Pro called directly on Google's Gemini API, bypassing fal.
 *
 * Same model as the `nano-banana` provider, different route: this one bills
 * through your own Google AI Studio account instead of paying fal's margin on
 * top, and AI Studio has a free tier for testing. The trade is that FLUX is not
 * available here — Black Forest Labs models are not on Google — so this engine
 * cannot do ControlNet.
 */
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3-pro-image";

const PROVIDER_ID = "google";

/**
 * Gemini takes inline base64 rather than a URL. The request has a total size
 * ceiling and base64 inflates bytes by a third, so refuse early with a message
 * that says what to do instead of letting the API return an opaque 400.
 */
const MAX_INLINE_BYTES = 14 * 1024 * 1024;

/** Gemini takes a resolution bucket, not pixel dimensions. */
function imageSizeBucket(maxSide: number): "1K" | "2K" | "4K" {
  if (maxSide <= 1024) return "1K";
  if (maxSide <= 1600) return "2K";
  return "4K";
}

const SUPPORTED_RATIOS: { label: string; value: number }[] = [
  { label: "21:9", value: 21 / 9 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:2", value: 3 / 2 },
  { label: "4:3", value: 4 / 3 },
  { label: "5:4", value: 5 / 4 },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "3:4", value: 3 / 4 },
  { label: "2:3", value: 2 / 3 },
  { label: "9:16", value: 9 / 16 },
];

/**
 * Gemini has no "auto" aspect ratio, so pick the closest supported one to the
 * source. Getting this wrong crops or stretches the geometry the render is
 * supposed to match, which matters more here than on a free-form image.
 */
function nearestAspectRatio(width: number, height: number): string {
  const target = width / height;
  return SUPPORTED_RATIOS.reduce((best, candidate) =>
    Math.abs(Math.log(candidate.value / target)) <
    Math.abs(Math.log(best.value / target))
      ? candidate
      : best,
  ).label;
}

/** `prepareImage` hands back a data URI; split it into the parts Gemini wants. */
function parseDataUri(uri: string): { mimeType: string; data: string } {
  // [\s\S] rather than the `s` flag: tsconfig targets ES2017.
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(uri);
  if (!match) {
    throw new ProviderError(
      "Ảnh nguồn không ở dạng data URI hợp lệ.",
      PROVIDER_ID,
    );
  }
  return { mimeType: match[1], data: match[2] };
}

export const googleProvider: RenderProvider = {
  id: "google",
  label: "Nano Banana Pro (Google trực tiếp)",
  blurb: "Cùng model Nano Banana nhưng tính tiền thẳng qua Google, không qua fal.",
  supportsControlNet: false,
  supportsMask: false,
  understandsVietnamese: true,
  promptStyle: "instruct",
  apiKeyUrl: "https://aistudio.google.com/apikey",
  apiKeyEnv: "GEMINI_API_KEY",

  isConfigured() {
    return Boolean(secret("GEMINI_API_KEY"));
  },

  modelFor() {
    return MODEL;
  },

  async prepareImage(buffer, mime) {
    if (buffer.byteLength > MAX_INLINE_BYTES) {
      throw new ProviderError(
        `Ảnh ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB là quá lớn để gửi thẳng cho Gemini ` +
          `(giới hạn ~${MAX_INLINE_BYTES / 1024 / 1024} MB). Giảm kích thước ảnh nguồn, ` +
          `hoặc chọn engine chạy qua fal.ai.`,
        PROVIDER_ID,
      );
    }
    return `data:${mime};base64,${buffer.toString("base64")}`;
  },

  async render(
    params: RenderParams,
    onProgress?: ProgressHandler,
  ): Promise<RenderOutcome> {
    const apiKey = secret("GEMINI_API_KEY");
    if (!apiKey) {
      throw new ProviderError(
        "Chưa có GEMINI_API_KEY. Lấy key ở aistudio.google.com/apikey rồi thêm ở mục Cài đặt.",
        PROVIDER_ID,
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const { mimeType, data } = parseDataUri(params.imageUrl);

    const request = {
      model: MODEL,
      input: [
        { type: "text" as const, text: params.prompt },
        { type: "image" as const, mime_type: mimeType, data },
      ],
      response_format: {
        type: "image" as const,
        aspect_ratio: nearestAspectRatio(
          params.imageSize.width,
          params.imageSize.height,
        ),
        image_size: imageSizeBucket(params.maxSide),
        mime_type: params.outputFormat === "jpeg" ? "image/jpeg" : "image/png",
      },
    };

    onProgress?.({ type: "queued" });

    try {
      // One interaction yields one image, so N images means N calls. Run them
      // together — they are independent and the latency is dominated by the model.
      const interactions = await Promise.all(
        Array.from({ length: params.numImages }, () =>
          ai.interactions.create(request),
        ),
      );

      onProgress?.({ type: "completed" });

      const images = interactions
        .map((interaction) => interaction.output_image)
        .filter((image): image is NonNullable<typeof image> => Boolean(image))
        .map((image) => {
          const contentType = image.mime_type ?? `image/${params.outputFormat}`;
          return {
            // saveRemoteImage fetches this; a data URI works there as well as a URL.
            url: image.uri ?? `data:${contentType};base64,${image.data ?? ""}`,
            width: params.imageSize.width,
            height: params.imageSize.height,
            contentType,
          };
        });

      if (images.length === 0) {
        throw new ProviderError(
          "Gemini không trả về ảnh nào. Có thể prompt đã bị bộ lọc an toàn chặn — thử diễn đạt lại.",
          PROVIDER_ID,
        );
      }

      return { model: MODEL, seed: params.seed, images };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(googleErrorMessage(error), PROVIDER_ID, error);
    }
  },
};

function googleErrorMessage(error: unknown): string {
  const status =
    (error as { status?: number })?.status ??
    (error as { code?: number })?.code;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 400 && /API key/i.test(message)) {
    return "GEMINI_API_KEY không hợp lệ. Kiểm tra lại ở aistudio.google.com/apikey.";
  }
  if (status === 401 || status === 403) {
    return "GEMINI_API_KEY bị từ chối. Kiểm tra key còn hiệu lực và đã bật quyền cho Gemini API.";
  }
  if (status === 429) {
    return "Vượt hạn mức Gemini API. Chờ ít phút, hoặc bật thanh toán cho project ở Google AI Studio.";
  }
  if (status === 404) {
    return `Không tìm thấy model "${MODEL}". Google có thể đã đổi tên — set lại qua biến môi trường GEMINI_IMAGE_MODEL.`;
  }
  return `Lỗi từ Gemini API (${MODEL}): ${message}`;
}
