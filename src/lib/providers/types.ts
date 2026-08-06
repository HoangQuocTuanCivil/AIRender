/**
 * Provider-agnostic contract for AI image rendering.
 *
 * Every cloud backend (fal.ai, Replicate, ...) implements `RenderProvider`, so the
 * API routes and UI never depend on a specific vendor's request shape.
 */

/** How strongly the generated image is forced to follow the source geometry. */
export type ControlMode = "canny" | "depth" | "none";

export const CONTROL_MODES: {
  id: ControlMode;
  label: string;
  hint: string;
}[] = [
  {
    id: "canny",
    label: "Canny — giữ đường nét",
    hint: "Bám theo cạnh/đường nét của ảnh gốc. Tốt nhất cho sketch, mặt đứng, ảnh line-art từ CAD.",
  },
  {
    id: "depth",
    label: "Depth — giữ khối",
    hint: "Bám theo chiều sâu và hình khối. Tốt nhất cho ảnh chụp màn hình 3D (SketchUp, Revit, Lumion clay).",
  },
  {
    id: "none",
    label: "Không — img2img tự do",
    hint: "Chỉ dùng ảnh gốc làm gợi ý màu/bố cục. Sáng tạo nhất nhưng dễ đổi hình khối.",
  },
];

export interface ImageSize {
  width: number;
  height: number;
}

export interface RenderParams {
  /** Publicly reachable URL, or a `data:` URI, of the source image. */
  imageUrl: string;
  prompt: string;
  negativePrompt?: string;
  controlMode: ControlMode;
  /** 0..1 — how much the ControlNet/control-LoRA constrains the result. */
  controlStrength: number;
  /** 0..1 — 0 preserves the source image, 1 fully remakes it. */
  strength: number;
  guidanceScale: number;
  steps: number;
  numImages: number;
  seed?: number;
  imageSize: ImageSize;
  /**
   * Longest output side in pixels. The source aspect ratio is always preserved
   * — a corridor view rendered at a different aspect than its control image
   * would drift out of alignment with the geometry it is supposed to follow.
   */
  maxSide: number;
  outputFormat: "jpeg" | "png";
}

export interface RenderedImage {
  url: string;
  width: number;
  height: number;
  contentType: string;
}

export interface RenderOutcome {
  images: RenderedImage[];
  /** Seed actually used, so a render can be reproduced from history. */
  seed?: number;
  /** Concrete model endpoint that served the request. */
  model: string;
}

export type ProgressEvent =
  | { type: "queued"; position?: number }
  | { type: "progress"; message: string }
  | { type: "completed" };

export type ProgressHandler = (event: ProgressEvent) => void;

export interface RenderProvider {
  id: string;
  label: string;
  /** One line shown under the engine name in the picker. */
  blurb: string;
  /**
   * False for instruction-driven edit models (Nano Banana, FLUX Kontext), which
   * have no control map and therefore no adherence dial. The UI hides the
   * ControlNet panel rather than showing controls that do nothing.
   */
  supportsControlNet: boolean;
  /**
   * "describe" — a scene description, for text-to-image models steered by a
   * control map. "instruct" — an edit instruction, for models that receive the
   * source image directly.
   */
  promptStyle: "describe" | "instruct";
  /** Docs URL for obtaining an API key — surfaced in the UI when unconfigured. */
  apiKeyUrl: string;
  /** Name of the env var holding the credential. */
  apiKeyEnv: string;
  /** True when the required credential is present in the environment. */
  isConfigured(): boolean;
  /** Model endpoint that would serve the given control mode. */
  modelFor(mode: ControlMode): string;
  /**
   * Turn local image bytes into something this provider can fetch — an upload
   * to the vendor's CDN where supported, a `data:` URI otherwise. Local storage
   * is not internet-reachable, so this step is mandatory before `render`.
   */
  prepareImage(buffer: Buffer, mime: string): Promise<string>;
  render(params: RenderParams, onProgress?: ProgressHandler): Promise<RenderOutcome>;
}

/** Thrown when a provider rejects the request; carries a user-facing message. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
